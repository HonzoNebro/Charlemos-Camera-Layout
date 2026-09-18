export function cloneConfiguration(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function configurationEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && configurationEqual(left[key], right[key]));
}

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function configurationChanges(before, after, path = []) {
  if (configurationEqual(before, after)) return [];
  if (record(before) && record(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      configurationChanges(before[key], after[key], [...path, key])
    );
  }
  return [{ path, before: cloneConfiguration(before), after: cloneConfiguration(after) }];
}

export function configurationValue(value, path) {
  return path.reduce((current, key) => current?.[key], value);
}

export function setConfigurationValue(value, path, next) {
  if (!path.length) return cloneConfiguration(next);
  if (path.some((key) => ["__proto__", "constructor", "prototype"].includes(key))) throw new Error("unsafePath");
  const result = cloneConfiguration(value ?? {});
  let parent = result;
  for (const key of path.slice(0, -1)) {
    if (!record(parent[key])) parent[key] = {};
    parent = parent[key];
  }
  const key = path.at(-1);
  if (next === undefined) delete parent[key];
  else parent[key] = cloneConfiguration(next);
  return result;
}

export class EditSession {
  constructor(sceneId, initial) {
    this.sceneId = sceneId;
    this.base = cloneConfiguration(initial);
    this.draft = cloneConfiguration(initial);
    this.conflicts = [];
    this.history = [];
    this.future = [];
    this.preview = false;
    this.busy = false;
    this.gesture = null;
  }

  get changes() {
    return configurationChanges(this.base, this.draft);
  }

  get dirty() {
    return this.changes.length > 0;
  }

  edit(path, value) {
    const next = setConfigurationValue(this.draft, path, value);
    if (configurationEqual(next, this.draft) || this.busy) return;
    if (!this.gesture) this.remember(this.draft);
    this.draft = next;
    this.future = [];
  }

  remember(value) {
    this.history.push(cloneConfiguration(value));
    if (this.history.length > 100) this.history.shift();
  }

  beginGesture() {
    if (!this.gesture) this.gesture = cloneConfiguration(this.draft);
  }

  endGesture(cancel = false) {
    if (!this.gesture) return;
    if (cancel) this.draft = this.gesture;
    else if (!configurationEqual(this.gesture, this.draft)) this.remember(this.gesture);
    this.gesture = null;
  }

  undo() {
    if (!this.history.length || this.busy || this.conflicts.length) return false;
    this.future.push(this.draft);
    this.draft = this.history.pop();
    return true;
  }

  redo() {
    if (!this.future.length || this.busy || this.conflicts.length) return false;
    this.remember(this.draft);
    this.draft = this.future.pop();
    return true;
  }

  reconcile(latest) {
    if (configurationEqual(latest, this.base)) return;
    this.endGesture();
    const changes = this.changes;
    const conflicts = [];
    let next = cloneConfiguration(latest);
    for (const change of changes) {
      const remote = configurationValue(latest, change.path);
      if (!configurationEqual(remote, change.before) && !configurationEqual(remote, change.after)) {
        conflicts.push({ ...change, remote: cloneConfiguration(remote) });
      }
      next = setConfigurationValue(next, change.path, change.after);
    }
    for (const conflict of this.conflicts) {
      if (!conflicts.some((item) => configurationEqual(item.path, conflict.path))) {
        const remote = configurationValue(latest, conflict.path);
        if (!configurationEqual(remote, configurationValue(next, conflict.path))) conflicts.push({ ...conflict, remote });
      }
    }
    this.base = cloneConfiguration(latest);
    this.draft = next;
    this.conflicts = conflicts;
    this.history = [];
    this.future = [];
  }

  resolve(path, useDraft) {
    const conflict = this.conflicts.find((item) => configurationEqual(item.path, path));
    if (!conflict) return;
    if (!useDraft) this.draft = setConfigurationValue(this.draft, path, conflict.remote);
    this.conflicts = this.conflicts.filter((item) => item !== conflict);
  }

  accept(saved) {
    this.base = cloneConfiguration(saved);
    this.draft = cloneConfiguration(saved);
    this.history = [];
    this.future = [];
    this.conflicts = [];
    this.gesture = null;
  }
}

export async function writeConfigurationBlocks(writes, { read, write }) {
  const completed = [];
  try {
    for (const item of writes) {
      if (!configurationEqual(read(item.key), item.before)) throw new Error("externalChange");
      completed.push(item);
      await write(item.key, cloneConfiguration(item.after));
      if (!configurationEqual(read(item.key), item.after)) throw new Error("externalChange");
    }
    if (writes.some((item) => !configurationEqual(read(item.key), item.after))) throw new Error("externalChange");
    return { ok: true, recovery: null };
  } catch (error) {
    let complete = true;
    for (const item of completed.reverse()) {
      if (configurationEqual(read(item.key), item.before)) continue;
      if (!configurationEqual(read(item.key), item.after)) {
        complete = false;
        continue;
      }
      try {
        await write(item.key, cloneConfiguration(item.before));
        if (!configurationEqual(read(item.key), item.before)) complete = false;
      } catch {
        complete = false;
      }
    }
    return { ok: false, recovery: complete ? "complete" : "incomplete", error };
  }
}
