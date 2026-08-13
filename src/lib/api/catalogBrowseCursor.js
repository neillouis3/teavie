import { ObjectId } from "mongodb";

function idLt(cursorId) {
  if (cursorId == null || cursorId === "") return null;
  try {
    return { $lt: new ObjectId(String(cursorId)) };
  } catch {
    return { $lt: String(cursorId) };
  }
}

/** @param {string | null | undefined} raw @param {string} sortBy */
export function parseBrowseCursor(raw, sortBy) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || parsed.s !== sortBy) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown> | null | undefined} doc @param {string} sortBy @param {{ anime?: boolean }} [opts] */
export function encodeBrowseCursor(doc, sortBy, { anime = false } = {}) {
  if (!doc?._id) return null;

  if (sortBy === "rating") {
    if (anime) {
      if (doc._topRatedVote == null) return null;
      return Buffer.from(
        JSON.stringify({
          s: "rating",
          v: doc._topRatedVote,
          id: String(doc._id),
        })
      ).toString("base64url");
    }
    if (doc._topRatedSort == null) return null;
    return Buffer.from(
      JSON.stringify({
        s: "rating",
        ts: doc._topRatedSort,
        vw: doc._voteWeight ?? 0,
        id: String(doc._id),
      })
    ).toString("base64url");
  }

  if (sortBy === "popularity") {
    if (doc._catalogPop == null) return null;
    return Buffer.from(
      JSON.stringify({
        s: "popularity",
        p: doc._catalogPop,
        id: String(doc._id),
      })
    ).toString("base64url");
  }

  return null;
}

/** @param {Record<string, unknown>} cursor @param {string} sortBy @param {{ anime?: boolean }} [opts] */
export function browseCursorMatch(cursor, sortBy, { anime = false } = {}) {
  const idClause = idLt(cursor.id);
  if (!idClause) return null;

  if (sortBy === "rating") {
    if (anime) {
      return {
        $or: [{ _topRatedVote: { $lt: cursor.v } }, { _topRatedVote: cursor.v, _id: idClause }],
      };
    }
    return {
      $or: [
        { _topRatedSort: { $lt: cursor.ts } },
        { _topRatedSort: cursor.ts, _voteWeight: { $lt: cursor.vw } },
        { _topRatedSort: cursor.ts, _voteWeight: cursor.vw, _id: idClause },
      ],
    };
  }

  if (sortBy === "popularity") {
    return {
      $or: [{ _catalogPop: { $lt: cursor.p } }, { _catalogPop: cursor.p, _id: idClause }],
    };
  }

  return null;
}
