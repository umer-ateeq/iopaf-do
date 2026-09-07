from pathlib import Path

from playwright.sync_api import sync_playwright


PORTAL = "file:///home/ubuntu/iopaf_v4/IOPAF-Assessment-Tool-v1.0.html"
OUTPUT = Path("/home/ubuntu/iopaf_v4/three_stream_shots")
OUTPUT.mkdir(parents=True, exist_ok=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(PORTAL, wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")

    # Enable all three parallel streams and prepare representative process evidence.
    indexes = page.evaluate(
        """() => {
          streamMeta.ops.active = true;
          streamMeta.sdlc.active = true;
          streamMeta.iam.active = true;
          streamMeta.sdlc.stds = Array.from(new Set([...(streamMeta.sdlc.stds || []), 'tmmi', 'iso29119']));
          meta.org = 'Illustrative enterprise';
          meta.unit = 'Digital technology';
          meta.assessor = 'Assessment team';
          meta.sponsor = 'Technology leadership';
          meta.ref = 'IOPAF visual demonstration';

          const sdlc = P.findIndex(p => streamOf(p) === 'sdlc' && !p.overlay);
          const tmmi = P.findIndex(p => streamOf(p) === 'sdlc' && p.overlay);
          const ops = P.findIndex(p => streamOf(p) === 'ops');
          [sdlc, tmmi, ops].forEach((index, practiceIndex) => {
            const practice = P[index];
            scope[practice.id] = true;
            questionsFor(practice).forEach((dimension, dimensionIndex) => {
              const base = [4, 3, 2, 4, 3, 2, 3][dimensionIndex];
              const gateId = qid(practice, dimensionIndex, 'g');
              answers[gateId] = base;
              notes[gateId] = 'Illustrative assessment evidence recorded for the public product walkthrough.';
              dimension.probes.slice(0, 3).forEach((_, probeIndex) => {
                answers[qid(practice, dimensionIndex, probeIndex)] = Math.max(1, Math.min(4, base - (probeIndex === 2 ? 1 : 0) + (practiceIndex === 1 ? -1 : 0)));
              });
            });
          });
          persist();
          return {
            sdlc,
            tmmi,
            ops,
            names: [P[sdlc]?.name, P[tmmi]?.name, P[ops]?.name],
          };
        }"""
    )
    assert min(indexes["sdlc"], indexes["tmmi"], indexes["ops"]) >= 0, indexes

    page.evaluate("go('standards')")
    page.wait_for_timeout(350)
    page.screenshot(path=str(OUTPUT / "standards-mapping.png"), full_page=True)

    page.evaluate("go('journey')")
    page.wait_for_timeout(350)
    page.screenshot(path=str(OUTPUT / "journey-ideation-to-operation.png"), full_page=True)

    for key, filename in (
        ("sdlc", "sdlc-cmmi-dev-assessment.png"),
        ("tmmi", "tmmi-testing-assessment.png"),
        ("ops", "it-operations-assessment.png"),
    ):
        page.evaluate("index => { currentProc=index; go('assess'); renderAssess(); window.scrollTo(0,0); }", indexes[key])
        page.wait_for_timeout(250)
        page.screenshot(path=str(OUTPUT / filename), full_page=False)

    page.evaluate("go('results'); renderResults()")
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUTPUT / "process-results-overview.png"), full_page=False)

    for panel, filename in (
        ("panel-heatmap", "process-results-heatmap.png"),
        ("panel-spiders", "process-results-spiders.png"),
        ("panel-gaps", "process-results-roadmap.png"),
        ("panel-reports", "process-results-reports.png"),
    ):
        page.evaluate("panel => resTab(document.querySelector(`[data-panel='${panel}']`))", panel)
        page.wait_for_timeout(250)
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path=str(OUTPUT / filename), full_page=False)

    print({"indexes": indexes, "screenshots": len(list(OUTPUT.glob("*.png"))), "errors": errors})
    assert not errors, errors
    browser.close()
