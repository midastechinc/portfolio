import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright
from supabase import Client, create_client


SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
LINKEDIN_EMAIL = os.environ["LINKEDIN_EMAIL"]
LINKEDIN_PASSWORD = os.environ["LINKEDIN_PASSWORD"]

COOKIE_FILE = Path(os.environ.get("LINKEDIN_COOKIE_FILE", ".cache/linkedin_session.json"))
HEADLESS = os.environ.get("LINKEDIN_HEADLESS", "true").lower() != "false"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


async def save_cookies(context, path: Path) -> None:
    ensure_parent_dir(path)
    cookies = await context.cookies()
    path.write_text(json.dumps(cookies), encoding="utf-8")
    print(f"[+] Session cookies saved to {path}")


async def load_cookies(context, path: Path) -> bool:
    if not path.exists():
        return False
    cookies = json.loads(path.read_text(encoding="utf-8"))
    await context.add_cookies(cookies)
    print(f"[+] Loaded session cookies from {path}")
    return True


async def wait_for_post_login(page) -> None:
    await page.wait_for_load_state("domcontentloaded")
    try:
        await page.wait_for_url("**linkedin.com/**", timeout=20000)
    except PlaywrightTimeoutError:
        pass

    if "checkpoint" in page.url or "challenge" in page.url:
        raise RuntimeError(
            "LinkedIn asked for a security challenge. Complete one successful login locally "
            "and refresh the saved session cookie before relying on the workflow."
        )

    if "login" in page.url:
        raise RuntimeError("LinkedIn login did not complete successfully.")


async def login_linkedin(page, context) -> None:
    print("[*] Logging into LinkedIn...")
    await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
    await page.locator("#username").fill(LINKEDIN_EMAIL)
    await page.locator("#password").fill(LINKEDIN_PASSWORD)
    await page.locator('[type="submit"]').click()
    await wait_for_post_login(page)
    print("[+] Login successful")
    await save_cookies(context, COOKIE_FILE)


async def ensure_linkedin_session(page, context) -> None:
    cookie_loaded = await load_cookies(context, COOKIE_FILE)
    await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")

    if cookie_loaded and "login" not in page.url and "checkpoint" not in page.url and "challenge" not in page.url:
        print("[+] Existing LinkedIn session is still valid")
        return

    if cookie_loaded:
        print("[!] Existing session expired, logging in again...")

    await login_linkedin(page, context)


async def page_scroll_to_bottom(page, times: int) -> None:
    for _ in range(times):
        await page.keyboard.press("End")
        await asyncio.sleep(1)


def clean_text(value: str | None) -> str:
    return (value or "").strip()


async def safe_inner_text(element) -> str:
    if not element:
        return ""
    try:
        return clean_text(await element.inner_text())
    except Exception:
        return ""


async def safe_attr(element, attr: str) -> str:
    if not element:
        return ""
    try:
        return clean_text(await element.get_attribute(attr))
    except Exception:
        return ""


async def scrape_received_invites(page) -> list[dict]:
    print("[*] Scraping received invites...")
    results: list[dict] = []

    await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/received/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)
    await page_scroll_to_bottom(page, 5)

    invite_cards = await page.query_selector_all("li.invitation-card")
    pulled_at = utc_now_iso()

    for card in invite_cards:
        try:
            name = await safe_inner_text(await card.query_selector(".invitation-card__title"))
            title = await safe_inner_text(await card.query_selector(".invitation-card__subtitle"))
            sent_at = await safe_inner_text(await card.query_selector(".time-badge"))
            note = await safe_inner_text(await card.query_selector(".invitation-card__custom-message"))
            mutual = await safe_inner_text(await card.query_selector(".member-insights__count"))
            url = await safe_attr(await card.query_selector("a.app-aware-link"), "href")

            results.append(
                {
                    "name": name or "Unknown",
                    "title": title,
                    "sent_at": sent_at,
                    "note": note,
                    "mutual_connections": mutual,
                    "profile_url": url,
                    "status": "pending",
                    "pulled_at": pulled_at,
                }
            )
        except Exception as exc:
            print(f"  [!] Error parsing received invite: {exc}")

    print(f"[+] Found {len(results)} received invites")
    return results


async def scrape_sent_invites(page) -> list[dict]:
    print("[*] Scraping sent invites...")
    results: list[dict] = []

    await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)
    await page_scroll_to_bottom(page, 8)

    invite_cards = await page.query_selector_all("li.invitation-card")
    pulled_at = utc_now_iso()

    for card in invite_cards:
        try:
            name = await safe_inner_text(await card.query_selector(".invitation-card__title"))
            title = await safe_inner_text(await card.query_selector(".invitation-card__subtitle"))
            sent_at = await safe_inner_text(await card.query_selector(".time-badge"))
            url = await safe_attr(await card.query_selector("a.app-aware-link"), "href")

            results.append(
                {
                    "name": name or "Unknown",
                    "title": title,
                    "sent_at": sent_at,
                    "profile_url": url,
                    "status": "pending",
                    "pulled_at": pulled_at,
                }
            )
        except Exception as exc:
            print(f"  [!] Error parsing sent invite: {exc}")

    print(f"[+] Found {len(results)} sent invites")
    return results


async def scrape_messages(page) -> list[dict]:
    print("[*] Scraping messages...")
    results: list[dict] = []

    await page.goto("https://www.linkedin.com/messaging/", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)

    threads = await page.query_selector_all("li.msg-conversation-listitem")
    pulled_at = utc_now_iso()

    for thread in threads:
        try:
            name = await safe_inner_text(await thread.query_selector(".msg-conversation-listitem__participant-names"))
            snippet = await safe_inner_text(await thread.query_selector(".msg-conversation-card__message-snippet-body"))
            message_date = await safe_inner_text(await thread.query_selector(".msg-conversation-listitem__time-stamp"))
            unread_el = await thread.query_selector(".notification-badge")
            thread_href = await safe_attr(await thread.query_selector("a.msg-conversation-listitem__link"), "href")
            direction = "outbound" if snippet.lower().startswith("you:") else "inbound"

            results.append(
                {
                    "name": name or "Unknown",
                    "last_message": snippet,
                    "message_date": message_date,
                    "direction": direction,
                    "is_unread": unread_el is not None,
                    "thread_url": f"https://www.linkedin.com{thread_href}" if thread_href.startswith("/") else thread_href,
                    "pulled_at": pulled_at,
                }
            )
        except Exception as exc:
            print(f"  [!] Error parsing message thread: {exc}")

    print(f"[+] Found {len(results)} message threads")
    return results


def replace_table_rows(supabase: Client, table: str, rows: list[dict]) -> None:
    print(f"[*] Replacing rows in {table}...")
    # Clear the table first so the dashboard always reflects the latest scrape.
    supabase.table(table).delete().neq("id", 0).execute()
    if not rows:
        print(f"[!] No rows found for {table}; table cleared.")
        return
    supabase.table(table).insert(rows).execute()
    print(f"[+] Pushed {len(rows)} rows to {table}")


async def main() -> None:
    print("=" * 56)
    print(" Midas Tech LinkedIn Scraper — Daily Pull")
    print(f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 56)

    supabase = get_supabase()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 1200},
        )
        page = await context.new_page()

        await ensure_linkedin_session(page, context)

        received = await scrape_received_invites(page)
        sent = await scrape_sent_invites(page)
        messages = await scrape_messages(page)

        replace_table_rows(supabase, "linkedin_received_invites", received)
        replace_table_rows(supabase, "linkedin_sent_invites", sent)
        replace_table_rows(supabase, "linkedin_message_replies", messages)

        await save_cookies(context, COOKIE_FILE)
        await browser.close()

    print("\n[+] Done. LinkedIn data pushed to Supabase.")
    print("=" * 56)


if __name__ == "__main__":
    asyncio.run(main())
