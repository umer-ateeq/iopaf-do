from pathlib import Path
import base64
import json
import subprocess
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:3000"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox"],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    page.goto(BASE + "/", wait_until="networkidle")
    assert page.locator("h1").first.inner_text() == "Turn IT capability into a decision you can defend."
    assert page.get_by_role("button", name="Register", exact=True).is_visible()
    assert page.locator(".hero-actions").get_by_role("button", name="Sign in", exact=True).is_visible()
    assert page.locator(".site-header").get_by_role("button", name="Register / Sign in", exact=True).is_visible()
    portal_palette = page.evaluate("""() => {
      const style = getComputedStyle(document.documentElement);
      return {ink: style.getPropertyValue('--ink').trim(), blue: style.getPropertyValue('--teal').trim(), paper: style.getPropertyValue('--paper').trim()};
    }""")
    assert portal_palette == {"ink": "#0b2e52", "blue": "#004c97", "paper": "#f0f2f5"}, portal_palette
    assert page.locator("#journey").get_by_text("See where capability is tested—and which standard governs it.").is_visible()
    assert page.locator("#journey .foundation-workbench .engine-frame img").is_visible()
    foundation_tabs = page.locator("#journey .compact-tabs [role='tab']")
    assert foundation_tabs.count() == 2
    foundation_tabs.nth(1).click()
    assert page.locator("#standards .standards-mini-grid span").count() == 14
    assert page.locator("#journey .compact-panel").get_by_role("heading", name="Fourteen sources · one governed engine", exact=True).is_visible()
    foundation_tabs.nth(0).click()
    assert page.locator("#streams .visual-subtabs [role='tab']").count() == 2
    analysis_tabs = page.locator("#model .compact-tabs [role='tab']")
    assert analysis_tabs.count() == 4
    analysis_tabs.nth(2).click()
    assert page.locator("#model .target-mini-grid span").count() == 9
    assert page.locator("#model").get_by_role("heading", name="148 controls · nine target levels", exact=True).is_visible()
    analysis_tabs.nth(3).click()
    assert page.locator("#model").get_by_text("Exact Beta intervals update control-failure uncertainty").is_visible()
    analysis_tabs.nth(0).click()
    output_tabs = page.locator("#outputs .compact-tabs [role='tab']")
    assert output_tabs.count() == 4
    engine_images = page.locator(".engine-frame img")
    assert engine_images.count() == 6
    for image_index in range(engine_images.count()):
        engine_images.nth(image_index).scroll_into_view_if_needed()
    page.wait_for_function(
        "() => Array.from(document.querySelectorAll('.engine-frame img')).every(image => image.complete && image.naturalWidth > 0)"
    )
    image_status = engine_images.evaluate_all(
        "images => images.map(image => ({complete: image.complete, width: image.naturalWidth}))"
    )
    assert all(item["complete"] and item["width"] > 0 for item in image_status), image_status
    desktop_overflow = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    desktop_height = page.evaluate("document.documentElement.scrollHeight")
    assert desktop_overflow <= 1, desktop_overflow
    assert desktop_height <= 6500, desktop_height
    page.goto(BASE + "/", wait_until="networkidle")
    page.keyboard.press("Tab")
    focus_sequence = []
    for _ in range(6):
        focus_sequence.append(page.evaluate("document.activeElement?.textContent?.trim() || ''"))
        page.keyboard.press("Tab")
    assert focus_sequence == [
        "IOPAFIT Operations Practice Assessment Framework",
        "Journey",
        "Capabilities",
        "Method",
        "Outputs",
        "Register / Sign in"
    ], focus_sequence
    foundation_tabs = page.locator("#journey .compact-tabs [role='tab']")
    foundation_tabs.nth(1).focus()
    page.keyboard.press("Enter")
    assert foundation_tabs.nth(1).get_attribute("aria-selected") == "true"
    foundation_tabs.nth(0).click()
    visual_subtabs = page.locator("#streams .visual-subtabs [role='tab']")
    visual_subtabs.nth(1).focus()
    page.keyboard.press("Enter")
    assert visual_subtabs.nth(1).get_attribute("aria-selected") == "true"
    assert page.locator("#stream-detail img").get_attribute("src") == "/manus-storage/tmmi-testing-assessment_649ed64a.webp"
    visual_subtabs.nth(0).click()
    analysis_tabs = page.locator("#model .compact-tabs [role='tab']")
    analysis_tabs.nth(3).focus()
    page.keyboard.press("Enter")
    assert analysis_tabs.nth(3).get_attribute("aria-selected") == "true"
    analysis_tabs.nth(0).click()
    output_tabs = page.locator("#outputs .compact-tabs [role='tab']")
    output_tabs.nth(2).focus()
    page.keyboard.press("Enter")
    assert output_tabs.nth(2).get_attribute("aria-selected") == "true"
    assert page.locator("#outputs img").get_attribute("src") == "/manus-storage/reports-centre_e3166e9f.webp"
    output_tabs.nth(0).click()
    stream_tabs = page.locator(".stream-tabs [role='tab']")
    assert stream_tabs.count() == 3
    stream_tabs.nth(2).focus()
    page.keyboard.press("Enter")
    assert stream_tabs.nth(2).get_attribute("aria-selected") == "true"
    assert page.locator("#stream-detail").get_by_text("Test control effectiveness at the right target").is_visible()
    assert page.locator("#stream-detail img").get_attribute("src") == "/manus-storage/controls-assessment_2321c2da.webp"
    stream_tabs.nth(1).click()
    assert page.locator("#stream-detail").get_by_text("Examine how technology is governed and operated").is_visible()
    assert page.locator("#stream-detail img").get_attribute("src") == "/manus-storage/it-operations-assessment_3c2d61a1.webp"

    first_visual_trigger = page.locator(".engine-frame-open").first
    first_visual_trigger.focus()
    page.keyboard.press("Enter")
    visual_dialog = page.get_by_role("dialog", name="Development · operations · IAM across nine stages")
    assert visual_dialog.is_visible()
    assert visual_dialog.locator("img").evaluate("image => image.complete && image.naturalWidth > 0")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    assert not page.locator(".visual-dialog").is_visible()
    assert first_visual_trigger.evaluate("element => document.activeElement === element")

    tour_launch = page.get_by_role("button", name="Take the guided tour", exact=True)
    tour_launch.click()
    tour_dialog = page.get_by_role("dialog", name="Follow assurance from ideation to operation")
    assert tour_dialog.is_visible()
    assert page.locator("#journey").evaluate("element => element.classList.contains('tour-target-active')")
    page.keyboard.press("ArrowRight")
    assert page.get_by_role("dialog", name="Separate the claimed level from the defensible level").is_visible()
    assert page.locator("#model").evaluate("element => element.classList.contains('tour-target-active')")
    close_tour = page.get_by_role("button", name="Close guided tour")
    close_tour.focus()
    page.keyboard.press("Shift+Tab")
    assert page.evaluate("document.activeElement?.textContent?.trim()") == "Next capability"
    page.keyboard.press("Escape")
    assert not page.locator(".tour-panel").is_visible()
    page.wait_for_timeout(150)
    assert tour_launch.evaluate("element => document.activeElement === element")

    register_launch = page.get_by_role("button", name="Register", exact=True)
    register_launch.click()
    account_dialog = page.get_by_role("dialog", name="Enter with an accountable identity.")
    assert account_dialog.is_visible()
    assert account_dialog.get_by_role("tab", name="Register", exact=True).get_attribute("aria-selected") == "true"
    assert account_dialog.get_by_role("button", name="Continue to sign in or sign up", exact=True).is_visible()

    register_request: dict[str, str] = {}

    def inspect_register(route):
        register_request["url"] = route.request.url
        route.abort()

    page.route("**/app-auth**", inspect_register)
    account_dialog.get_by_role("button", name="Continue to sign in or sign up", exact=True).click()
    page.wait_for_timeout(300)
    assert "url" in register_request, "Unified registration launcher did not navigate"
    register_params = parse_qs(urlparse(register_request["url"]).query)
    assert register_params.get("type") == ["signIn"]
    register_state = json.loads(base64.b64decode(register_params["state"][0]).decode())
    assert register_state["returnPath"] == "/portal", register_state
    page.unroute("**/app-auth**", inspect_register)
    page.goto(BASE + "/", wait_until="networkidle")

    page.locator(".hero-actions").get_by_role("button", name="Sign in", exact=True).click()
    account_dialog = page.get_by_role("dialog", name="Enter with an accountable identity.")
    account_dialog.get_by_role("tab", name="Sign in", exact=True).click()
    assert account_dialog.get_by_role("tab", name="Sign in", exact=True).get_attribute("aria-selected") == "true"
    assert account_dialog.get_by_role("button", name="Continue to secure sign in", exact=True).is_visible()
    account_dialog.get_by_role("button", name="Close Register and Sign in window").focus()
    page.keyboard.press("Shift+Tab")
    assert page.evaluate("document.activeElement?.textContent?.trim()") == "Continue to secure sign in"
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    assert not page.locator(".account-window").is_visible()
    assert page.locator(".hero-actions").get_by_role("button", name="Sign in", exact=True).evaluate("element => document.activeElement === element")

    response = context.request.get(BASE + "/app.html", max_redirects=0)
    assert response.status == 302, response.status
    assert response.headers.get("location") == "/?auth=required", response.headers

    page.goto(BASE + "/portal", wait_until="networkidle")
    page.wait_for_url(BASE + "/?auth=required")
    assert page.locator("text=Sign in or registration is required before the assessment engine can be opened.").is_visible()
    required_dialog = page.get_by_role("dialog", name="Enter with an accountable identity.")
    assert required_dialog.is_visible()
    assert required_dialog.get_by_role("tab", name="Sign in", exact=True).get_attribute("aria-selected") == "true"

    oauth_request: dict[str, str] = {}

    def inspect_oauth(route):
        oauth_request["url"] = route.request.url
        route.abort()

    page.route("**/app-auth**", inspect_oauth)
    required_dialog.get_by_role("button", name="Continue to secure sign in", exact=True).focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    assert "url" in oauth_request, "OAuth launcher did not navigate"
    params = parse_qs(urlparse(oauth_request["url"]).query)
    assert params.get("type") == ["signIn"]
    assert params.get("redirectUri") == [BASE + "/api/oauth/callback"]
    assert params.get("appId", [""])[0]
    assert params.get("state", [""])[0]
    signin_state = json.loads(base64.b64decode(params["state"][0]).decode())
    assert signin_state["returnPath"] == "/portal", signin_state
    page.unroute("**/app-auth**", inspect_oauth)

    callback_failure = context.request.get(BASE + "/api/oauth/callback", max_redirects=0)
    assert callback_failure.status == 302, callback_failure.status
    assert callback_failure.headers.get("location") == "/?auth=failed", callback_failure.headers
    page.goto(BASE + "/?auth=failed", wait_until="networkidle")
    assert page.get_by_role("dialog", name="Enter with an accountable identity.").is_visible()
    assert page.get_by_text("Account verification did not complete. Please retry and allow cookies for this site.").is_visible()

    mobile = context.new_page()
    mobile.set_viewport_size({"width": 390, "height": 844})
    mobile.goto(BASE + "/", wait_until="networkidle")
    mobile_overflow = mobile.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    mobile_height = mobile.evaluate("document.documentElement.scrollHeight")
    assert mobile_overflow <= 1, mobile_overflow
    assert mobile_height <= 9000, mobile_height
    assert mobile.locator("h1").first.is_visible()
    assert mobile.locator(".engine-hero-visual").is_visible()
    mobile.locator(".site-header").get_by_role("button", name="Register / Sign in", exact=True).click()
    assert mobile.locator(".account-window").is_visible()
    mobile_account_overflow = mobile.locator(".account-window").evaluate(
        "element => element.scrollWidth - element.clientWidth"
    )
    assert mobile_account_overflow <= 1, mobile_account_overflow
    mobile.keyboard.press("Escape")
    mobile.get_by_role("button", name="Take the guided tour", exact=True).click()
    assert mobile.locator(".tour-panel").is_visible()
    mobile_tour_overflow = mobile.locator(".tour-panel").evaluate(
        "element => element.scrollWidth - element.clientWidth"
    )
    assert mobile_tour_overflow <= 1, mobile_tour_overflow
    mobile.keyboard.press("Escape")

    tablet = context.new_page()
    tablet.set_viewport_size({"width": 768, "height": 1024})
    tablet.goto(BASE + "/", wait_until="networkidle")
    tablet_overflow = tablet.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    tablet_height = tablet.evaluate("document.documentElement.scrollHeight")
    assert tablet_overflow <= 1, tablet_overflow
    assert tablet_height <= 7500, tablet_height
    assert tablet.locator(".hero-section").is_visible()
    assert tablet.locator(".engine-hero-visual").is_visible()
    assert tablet.locator("#access .auth-panel").is_visible()
    tablet.get_by_role("button", name="Take the guided tour", exact=True).click()
    assert tablet.locator(".tour-panel").is_visible()
    tablet_tour_overflow = tablet.locator(".tour-panel").evaluate(
        "element => element.scrollWidth - element.clientWidth"
    )
    assert tablet_tour_overflow <= 1, tablet_tour_overflow
    tablet.keyboard.press("Escape")

    session_token = subprocess.check_output(
        ["node", "create_local_session.mjs"], text=True
    ).strip()
    authenticated = browser.new_context(viewport={"width": 1440, "height": 1000})
    authenticated.add_cookies(
        [{"name": "app_session_id", "value": session_token, "url": BASE}]
    )
    portal = authenticated.new_page()
    portal.goto(BASE + "/portal", wait_until="networkidle")
    assert portal.url == BASE + "/portal", portal.url
    assert portal.locator(".portal-bar").is_visible()
    frame = portal.frame_locator("iframe.portal-frame")
    frame.locator("#view-framework").wait_for(state="attached")
    engine_identity = frame.locator("body").evaluate(
        "() => ({title: document.title, hasGo: typeof go === 'function', controls: !!document.getElementById('view-controls')})"
    )
    assert engine_identity["hasGo"] and engine_identity["controls"], engine_identity
    frame.locator("body").evaluate("() => go('controls')")
    assert frame.locator("#view-controls").is_visible()
    portal.locator(".portal-user a").focus()
    assert portal.evaluate("document.activeElement?.textContent?.trim()") == "Website"
    portal.keyboard.press("Tab")
    assert portal.evaluate("document.activeElement?.textContent?.trim()") == "Sign out"
    portal.get_by_role("button", name="Sign out", exact=True).click()
    portal.wait_for_url(BASE + "/")
    portal.goto(BASE + "/portal", wait_until="networkidle")
    portal.wait_for_url(BASE + "/?auth=required")
    authenticated.close()

    assert not errors, errors
    browser.close()

print(
    {
        "public_root": True,
        "registration_launcher": True,
        "unauthenticated_portal_redirect": True,
        "desktop_overflow": desktop_overflow,
        "desktop_height": desktop_height,
        "mobile_overflow": mobile_overflow,
        "mobile_height": mobile_height,
        "tablet_overflow": tablet_overflow,
        "tablet_height": tablet_height,
        "tablet_tour_overflow": tablet_tour_overflow,
        "keyboard_focus_order": True,
        "keyboard_oauth_activation": True,
        "unified_register_flow": True,
        "signed_portal_return_state": True,
        "callback_failure_recovery": True,
        "logout_reprotects_portal": True,
        "portal_palette_alignment": portal_palette,
        "account_window_visible": True,
        "account_window_focus_trap": True,
        "account_window_focus_restoration": True,
        "account_window_mobile_overflow": mobile_account_overflow,
        "authenticated_return_to_portal": True,
        "guided_tour_keyboard_navigation": True,
        "guided_tour_focus_trap": True,
        "guided_tour_focus_restoration": True,
        "authentic_engine_images_loaded": len(image_status),
        "full_screen_visual_inspection": True,
        "visual_focus_restoration": True,
        "mobile_tour_overflow": mobile_tour_overflow,
        "authenticated_engine_loaded": True,
        "engine_controls_interaction": True,
    }
)
