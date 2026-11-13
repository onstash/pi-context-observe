import type { ContextWithSystemEvent, ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Key, matchesKey, ScrollView, Text } from "@earendil-works/pi-tui";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export default function contextObserve(pi: ExtensionAPI) {
  let captureNext = false;
  let latestContext: ContextWithSystemEvent["messages"] = [];
  pi.on("context_with_system", async (event, ctx) => {
    if (!captureNext) {
      return;
    }

    captureNext = false;

    if (!event.messages.length) {
      ctx.ui.notify(`Context is empty`, "info");

      return;
    }

    latestContext = event.messages;
    const outputPath = path.join(ctx.cwd, "context-capture.json");
    await writeFile(outputPath, JSON.stringify(event.messages, null, 2), "utf8");
    ctx.ui.notify(`Context written to ${outputPath}`, "info");
  });

  pi.registerCommand("context-capture", {
    description: "Capture the next LLM context to JSON",
    handler: async (_args, ctx) => {
      captureNext = true;
      ctx.ui.notify("The next LLM context will be captured.", "info");
    },
  });

  pi.registerCommand("context-observe", {
    description: "Obeserve the LLM context",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return;

      if (!latestContext.length) {
        ctx.ui.notify("No context has been captured yet.", "info");

        return;
      }

      const content = JSON.stringify(
        latestContext.map((message) => message.role),
        null,
        2,
      );

      await ctx.ui.custom<void>(
        (tui, _theme, _keybindings, done) => {
          class ContextView extends ScrollView {
            handleInput(data: string) {
              if (matchesKey(data, Key.escape) || data === "q") {
                done();

                return;
              }

              if (matchesKey(data, Key.up)) this.scrollBy(-1);

              if (matchesKey(data, Key.down)) this.scrollBy(1);

              if (matchesKey(data, Key.pageUp)) {
                this.scrollBy(-Math.max(1, this.viewportHeight - 1));
              }

              if (matchesKey(data, Key.pageDown)) {
                this.scrollBy(Math.max(1, this.viewportHeight - 1));
              }

              if (matchesKey(data, Key.home)) this.scrollToStart();

              if (matchesKey(data, Key.end)) this.scrollToEnd();

              tui.requestRender();
            }
          }

          return new ContextView(new Text(content, 1, 1), {
            primary: true,
            scrollbar: "always",
          });
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "80%",
            anchor: "center",
          },
        },
      );
    },
  });
}
