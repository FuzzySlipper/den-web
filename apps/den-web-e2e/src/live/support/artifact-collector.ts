import type { Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface EvidencePacket {
  readonly scenario: string;
  readonly baseUrl: string;
  readonly milestones: readonly string[];
  readonly visibleText: string;
  readonly nonClaims: readonly string[];
}

export async function writeEvidencePacket(
  page: Page,
  testInfo: TestInfo,
  packet: Omit<EvidencePacket, 'visibleText'>,
): Promise<void> {
  const visibleText = await page.locator('body').innerText();
  const output: EvidencePacket = { ...packet, visibleText };
  await writeFile(
    join(testInfo.outputDir, 'evidence-packet.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );
}

