import { MODULE_ID } from "./constants.js";
import { appId, rowHtml, sectionHtml } from "./camera-config-ui.js";
import { currentSceneId, localize, selectedUser, usersForConfig } from "./camera-config-shared.js";
import { collectModuleDebugReport } from "./debug-report.js";
import { replaceAppContent } from "./dom-replace.js";

const ISSUE_URL = "https://github.com/HonzoNebro/Charlemos-Camera-Layout/issues/new/choose";

function titleKey() {
  return `${MODULE_ID}.ui.supportReport.title`;
}

export function formatDebugReport(report) {
  return JSON.stringify(report, null, 2);
}

function reportSection(context) {
  return sectionHtml(localize("ui.supportReport.section"), localize("ui.supportReport.sectionDesc"), [
    rowHtml(localize("ui.supportReport.player"), `<div class="charlemos-support-report-player">${foundry.utils.escapeHTML(context.playerName)}</div>`),
    `<textarea id="${context.reportId}" class="charlemos-support-report-output" readonly spellcheck="false">${foundry.utils.escapeHTML(context.reportText)}</textarea>`
  ]);
}

export function buildHtml(context) {
  return [
    `<div class="charlemos-config-shell" id="${context.shellId}">`,
    `<h2>${context.title}</h2>`,
    `<p class="charlemos-section-desc">${foundry.utils.escapeHTML(context.description)}</p>`,
    `<div class="charlemos-config-form">`,
    `<div class="charlemos-config-scroll">`,
    reportSection(context),
    `</div>`,
    `<div class="charlemos-actions">`,
    `<button type="button" data-action="refresh-report">${localize("ui.supportReport.actions.refresh")}</button>`,
    `<button type="button" data-action="copy-report">${localize("ui.supportReport.actions.copy")}</button>`,
    `<button type="button" data-action="open-issue">${localize("ui.supportReport.actions.openIssue")}</button>`,
    `</div>`,
    `</div>`,
    `</div>`
  ].join("");
}

export class SupportReportApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-support-report`,
    tag: "section",
    window: {
      title: titleKey(),
      resizable: true
    },
    position: {
      width: 820,
      height: 760
    }
  };

  constructor(options = {}) {
    super(options);
    this.selectedUserId = options.selectedUserId ?? game.user?.id ?? null;
    this.reportText = "";
  }

  scopedId(suffix) {
    return `${appId(suffix)}-${this.id}`;
  }

  async _prepareContext() {
    const users = usersForConfig();
    const selected = selectedUser(users, this.selectedUserId);
    this.selectedUserId = selected?.id ?? game.user?.id ?? null;
    const report = collectModuleDebugReport(this.selectedUserId, {
      sceneId: currentSceneId(),
      includeRendererSnapshot: true
    });
    this.reportText = formatDebugReport(report);
    return {
      title: game.i18n.localize(titleKey()),
      description: localize("ui.supportReport.description"),
      shellId: this.scopedId("shell"),
      reportId: this.scopedId("report"),
      playerName: selected?.name ?? "",
      reportText: this.reportText
    };
  }

  async _renderHTML(context) {
    return buildHtml(context);
  }

  _replaceHTML(result, content) {
    replaceAppContent(content, result);
  }

  async _onRender() {
    const root = document.getElementById(this.scopedId("shell"));
    if (!root) return;
    root.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "refresh-report") await this.render(true);
      if (action === "copy-report") await this.copyReport();
      if (action === "open-issue") this.openIssuePage();
    });
  }

  async copyReport() {
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(this.reportText);
      } else {
        const textarea = document.getElementById(this.scopedId("report"));
        if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("textarea unavailable");
        textarea.focus();
        textarea.select();
        const copied = typeof document?.execCommand === "function" ? document.execCommand("copy") : false;
        if (!copied) throw new Error("clipboard unavailable");
      }
      ui.notifications.info(localize("ui.supportReport.notifications.copied"));
    } catch (error) {
      console.warn(`${MODULE_ID} | support report copy failed`, {
        playerId: this.selectedUserId,
        sceneId: currentSceneId(),
        error
      });
      ui.notifications.error(localize("ui.supportReport.notifications.copyFailed"));
    }
  }

  openIssuePage() {
    if (typeof globalThis.window?.open !== "function") {
      ui.notifications.error(localize("ui.supportReport.notifications.issueOpenFailed"));
      return;
    }
    globalThis.window.open(ISSUE_URL, "_blank", "noopener");
  }
}
