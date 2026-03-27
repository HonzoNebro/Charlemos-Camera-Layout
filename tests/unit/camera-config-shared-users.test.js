import test from "node:test";
import assert from "node:assert/strict";
import { usersForConfig } from "../../scripts/camera-config-shared.js";

test("usersForConfig returns all users by default and sorts active users first", () => {
  globalThis.game = {
    users: {
      contents: [
        { id: "u3", name: "Cara", active: false },
        { id: "u2", name: "Beto", active: true },
        { id: "u1", name: "Ana", active: true }
      ]
    }
  };

  const users = usersForConfig();

  assert.deepEqual(
    users.map((user) => [user.id, user.active]),
    [
      ["u1", true],
      ["u2", true],
      ["u3", false]
    ]
  );
});

test("usersForConfig can filter to active users only", () => {
  globalThis.game = {
    users: {
      contents: [
        { id: "u3", name: "Cara", active: false },
        { id: "u2", name: "Beto", active: true },
        { id: "u1", name: "Ana", active: true }
      ]
    }
  };

  const users = usersForConfig({ activeOnly: true });

  assert.deepEqual(
    users.map((user) => user.id),
    ["u1", "u2"]
  );
});
