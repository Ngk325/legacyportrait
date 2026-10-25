// Data retention (privacy page, master prompt 7.6):
// - unpaid drafts: the portrait, its photos, cached print files and pending orders are deleted 30 days after the last change
// - delivered orders: the original photos are deleted 90 days after delivery (the print files are kept for reprints)
// - test portraits (utm.test set by the team) can be removed on demand
// AI cost rows are kept for the books but unlinked from the deleted portrait.

export const RETENTION = { unpaidDays: 30, deliveredPhotoDays: 90 };

async function deletePrefix(env, prefix) {
  let n = 0, cursor;
  do {
    const page = await env.PHOTOS.list({ prefix, cursor, limit: 1000 });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) { await env.PHOTOS.delete(keys); n += keys.length; }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return n;
}

async function purgePortrait(env, id) {
  const files = (await deletePrefix(env, `photos/${id}/`)) + (await deletePrefix(env, `prints/v2/${id}/`)) + (await deletePrefix(env, `prints/${id}/`));
  await env.DB.batch([
    env.DB.prepare("UPDATE ai_calls SET portrait_id = NULL WHERE portrait_id = ?").bind(id),
    env.DB.prepare("UPDATE errors SET portrait_id = NULL WHERE portrait_id = ?").bind(id),
    env.DB.prepare("DELETE FROM orders WHERE portrait_id = ? AND status = 'pending'").bind(id),
    env.DB.prepare("DELETE FROM portraits WHERE id = ?").bind(id),
  ]);
  return files;
}

// Returns a report. With apply=false nothing is deleted (dry run).
export async function runRetention(env, { apply = false, includeTests = false, now = new Date(), limit = 200 } = {}) {
  const daysAgo = (d) => new Date(now.getTime() - d * 864e5).toISOString().replace("T", " ").slice(0, 19); // D1 datetime() format
  const unpaid = (await env.DB.prepare("SELECT id FROM portraits WHERE status NOT IN ('paid', 'delivered') AND updated_at < ? ORDER BY updated_at LIMIT ?")
    .bind(daysAgo(RETENTION.unpaidDays), limit).all()).results.map((r) => r.id);
  const delivered = (await env.DB.prepare("SELECT id FROM portraits WHERE status = 'delivered' AND updated_at < ? AND photos != '[]' ORDER BY updated_at LIMIT ?")
    .bind(daysAgo(RETENTION.deliveredPhotoDays), limit).all()).results.map((r) => r.id);
  const tests = includeTests
    ? (await env.DB.prepare("SELECT id FROM portraits WHERE json_extract(utm, '$.test') IS NOT NULL AND status NOT IN ('paid', 'delivered') LIMIT ?").bind(limit).all()).results.map((r) => r.id)
    : [];
  // paid test portraits (made paid by hand to test print files) are removed too when asked
  const paidTests = includeTests
    ? (await env.DB.prepare("SELECT id FROM portraits WHERE json_extract(utm, '$.test') IS NOT NULL AND status IN ('paid', 'delivered') AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.portrait_id = portraits.id AND o.status != 'pending') LIMIT ?").bind(limit).all()).results.map((r) => r.id)
    : [];

  const toPurge = [...new Set([...unpaid, ...tests, ...paidTests])];
  const report = { apply, unpaidDrafts: unpaid.length, testPortraits: tests.length + paidTests.length, deliveredPhotoCleanups: delivered.length, filesDeleted: 0, ids: toPurge.slice(0, 50) };
  if (!apply) return report;

  for (const id of toPurge) report.filesDeleted += await purgePortrait(env, id);
  for (const id of delivered) {
    report.filesDeleted += await deletePrefix(env, `photos/${id}/`);
    await env.DB.prepare("UPDATE portraits SET photos = '[]' WHERE id = ?").bind(id).run();
  }
  return report;
}
