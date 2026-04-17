import { and, eq, isNull } from 'drizzle-orm';
import { db } from './index';
import { templates } from './schema';
import { SYSTEM_TEMPLATES } from '@/lib/templates/system-templates';

async function main() {
  for (const t of SYSTEM_TEMPLATES) {
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.name, t.name), isNull(templates.userId), eq(templates.isSystem, true)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(templates)
        .set({
          description: t.description,
          promptTemplate: t.promptTemplate,
          outputSchema: t.outputSchema,
          markdownTemplate: t.markdownTemplate,
        })
        .where(eq(templates.id, existing[0].id));
      console.log(`updated system template: ${t.name}`);
    } else {
      await db.insert(templates).values({
        name: t.name,
        description: t.description,
        isSystem: true,
        userId: null,
        promptTemplate: t.promptTemplate,
        outputSchema: t.outputSchema,
        markdownTemplate: t.markdownTemplate,
      });
      console.log(`inserted system template: ${t.name}`);
    }
  }

  console.log('seed complete');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
