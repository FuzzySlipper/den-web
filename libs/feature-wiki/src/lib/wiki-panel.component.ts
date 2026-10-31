import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { LocalTimeComponent, RichMarkdownViewComponent, type RichMarkdownLinkPolicy } from '@den-web/components';
import {
  WIKI_ZONES,
  normalizeWikiPath,
  resolveWikiHref,
  stripFrontmatter,
  trailPath,
  wikiCommitView,
  wikiFacts,
  wikiList,
  wikiListing,
  wikiParentFolder,
  wikiTitle,
  wikiZoneOf,
  linkContentPaths,
  withoutLeadingTitle,
  type WikiZone,
} from '@den-web/domain';
import type { ClassifiedError, DenWikiReadResult, DenWikiTaxonomyResult } from '@den-web/protocol';
import { WIKI_STORE, stateValue, type AsyncState } from '@den-web/store';
import { wikiPanelStyles } from './wiki-panel.styles';

type WikiView = WikiZone | 'tags' | 'search' | 'curation';

const views: readonly { readonly view: WikiView; readonly label: string }[] = [
  ...WIKI_ZONES.map(({ zone, label }) => ({ view: zone, label })),
  { view: 'tags', label: 'Tags' },
  { view: 'curation', label: 'Curation' },
];

function isWikiView(value: string | null): value is WikiView {
  return value === 'search' || views.some((item) => item.view === value);
}

/**
 * A read-only den-wiki reader. Its state lives in the URL (`view`, `folder`,
 * `tag`, `q`, `path`) so pages can be linked, opened in new tabs and walked
 * back through. It only reads: editing stays in the OpenKnowledge UI.
 */
@Component({
  selector: 'den-wiki-panel',
  standalone: true,
  imports: [LocalTimeComponent, RichMarkdownViewComponent, RouterLink],
  styles: [wikiPanelStyles],
  template: `
    <section class="surface" aria-label="Wiki">
      <header>
        <div class="heading">
          <h2>Wiki</h2>
          <span class="muted">den-wiki, read-only. Pages, captured sources and research trails, with their provenance and curation state.</span>
        </div>
        <form class="toolbar" role="search" (submit)="submitSearch($event, query.value)">
          <input #query type="search" name="q" placeholder="Search the wiki" aria-label="Search the wiki" [value]="params().q" />
          <button type="submit">Search</button>
          <button type="button" aria-label="Reload from den-wiki" (click)="reload()">↻ Reload</button>
        </form>
      </header>

      <div class="layout">
        <nav class="browse" aria-label="Browse the wiki">
          <div class="tabs" role="tablist">
            @for (item of views; track item.view) {
              <a
                role="tab"
                routerLink="/wiki"
                [queryParams]="viewParams(item.view)"
                [class.active]="params().view === item.view"
                [attr.aria-selected]="params().view === item.view"
              >{{ item.label }}</a>
            }
            @if (params().view === 'search') {
              <a role="tab" class="active" aria-selected="true" routerLink="/wiki" [queryParams]="{ view: 'search', q: params().q }">Search</a>
            }
          </div>

          @switch (params().view) {
            @case ('tags') {
              @if (failure(store.taxonomy()); as error) {
                <p class="notice danger" role="alert">Could not load the taxonomy ({{ errorText(error) }}).</p>
              }
              @if (taxonomy(); as tax) {
                @if (params().tag; as tag) {
                  <a class="crumb" routerLink="/wiki" [queryParams]="{ view: 'tags' }">← All tags</a>
                  <h3>Tagged {{ tag }}</h3>
                  <ul class="entries">
                    @for (path of tagPages(tax, tag); track path) {
                      <li><a routerLink="/wiki" [queryParams]="pageParams(path)" [class.current]="path === openPath()">{{ titleFromPath(path) }}</a></li>
                    } @empty {
                      <li class="muted">No pages use this tag.</li>
                    }
                  </ul>
                } @else {
                  <h3 class="small-label">Tags</h3>
                  <ul class="entries">
                    @for (tag of tax.tags ?? []; track tag.name) {
                      <li><a routerLink="/wiki" [queryParams]="{ view: 'tags', tag: tag.name }" [attr.title]="tag.description">{{ tag.name }}</a> <span class="count">{{ tag.pages?.length ?? 0 }}</span></li>
                    }
                    @for (tag of tax.unlisted_tags ?? []; track tag.name) {
                      <li><a routerLink="/wiki" [queryParams]="{ view: 'tags', tag: tag.name }" title="Used by pages but not in taxonomy.yml">{{ tag.name }}</a> <span class="count">{{ tag.pages?.length ?? 0 }}</span> <span class="badge warn">unlisted</span></li>
                    }
                  </ul>
                  <h3 class="small-label">Types</h3>
                  <ul class="entries">
                    @for (type of tax.types ?? []; track type.name) {
                      <li><a routerLink="/wiki" [queryParams]="{ view: 'tags', tag: 'type:' + type.name }" [attr.title]="type.description">{{ type.name }}</a> <span class="count">{{ type.pages?.length ?? 0 }}</span></li>
                    }
                  </ul>
                }
              } @else if (!failure(store.taxonomy())) {
                <p class="muted">Loading the taxonomy…</p>
              }
            }
            @case ('search') {
              @if (failure(store.search()); as error) {
                <p class="notice danger" role="alert">Search failed ({{ errorText(error) }}).</p>
              }
              @if (searchResult(); as result) {
                <ul class="entries results">
                  @for (hit of result.results ?? []; track hit.path) {
                    <li>
                      <a routerLink="/wiki" [queryParams]="pageParams(hit.path)" [class.current]="normalize(hit.path) === openPath()">{{ hit.title || titleFromPath(hit.path) }}</a>
                      <span class="path">{{ hit.path }}</span>
                      @if (hit.snippet) { <span class="snippet">{{ hit.snippet }}</span> }
                    </li>
                  } @empty {
                    <li class="muted">Nothing matches “{{ result.query }}”.</li>
                  }
                </ul>
              } @else if (!failure(store.search())) {
                <p class="muted">Searching…</p>
              }
            }
            @case ('curation') {
              <p class="muted">The latest curation scan: duplicates, dead links, orphans, stale and unreviewed pages, and proposals waiting to be folded in. It is computed when you open this tab.</p>
            }
            @default {
              @if (failure(store.listing()); as error) {
                <p class="notice danger" role="alert">Could not list {{ params().folder }} ({{ errorText(error) }}).</p>
              }
              @if (listing(); as list) {
                @if (parentFolder(list.folder); as parent) {
                  <a class="crumb" routerLink="/wiki" [queryParams]="{ view: params().view, folder: parent }">← {{ parent }}</a>
                }
                @if (list.description) { <p class="zone-note">{{ list.description }}</p> }
                <ul class="entries">
                  @for (entry of list.entries; track entry.path) {
                    <li>
                      @if (entry.folder) {
                        <a class="folder" routerLink="/wiki" [queryParams]="{ view: params().view, folder: entry.path }">📁 {{ entry.title }}</a>
                        @if (entry.count !== null) { <span class="count">{{ entry.count }}</span> }
                      } @else {
                        <a routerLink="/wiki" [queryParams]="pageParams(entry.path)" [class.current]="entry.path === openPath()">{{ entry.title }}</a>
                        @if (entry.curation === 'unreviewed') { <span class="badge warn">unreviewed</span> }
                      }
                    </li>
                  } @empty {
                    <li class="muted">This folder is empty.</li>
                  }
                </ul>
              } @else if (!failure(store.listing())) {
                <p class="muted">Loading…</p>
              }
            }
          }
        </nav>

        <article class="reader" aria-live="polite">
          @if (openPath()) {
            @if (failure(store.page()); as error) {
              <p class="notice danger" role="alert">Could not read {{ openPath() }} ({{ errorText(error) }}).</p>
            }
            @if (page(); as current) {
              <div class="page-head">
                <span class="small-label">{{ zoneLabel(current.path) }} · {{ current.path }}</span>
                <h1>{{ titleOf(current) }}</h1>
                @if (current.frontmatter?.question; as question) { <p class="question">{{ question }}</p> }
              </div>

              <div class="page-grid">
                <div class="body">
                  <den-rich-markdown [content]="body()" [policy]="linkPolicy()" (linkActivated)="followLink($event)" />
                </div>

                <aside class="facts" aria-label="Page details">
                  @if (facts().length > 0) {
                    <dl>
                      @for (fact of facts(); track fact.label) {
                        <div>
                          <dt>{{ fact.label }}</dt>
                          <dd [class.badge]="fact.label === 'Curation'" [class.warn]="fact.value === 'unreviewed'">{{ fact.value }}</dd>
                        </div>
                      }
                    </dl>
                  }
                  @if (frontList('tags').length > 0) {
                    <h3 class="small-label">Tags</h3>
                    <div class="chips">
                      @for (tag of frontList('tags'); track tag) {
                        <a class="chip" routerLink="/wiki" [queryParams]="{ view: 'tags', tag: tag }">{{ tag }}</a>
                      }
                    </div>
                  }
                  @if (frontList('aliases').length > 0) {
                    <h3 class="small-label">Aliases</h3>
                    <p class="aliases">{{ frontList('aliases').join(' · ') }}</p>
                  }
                  @if (current.frontmatter?.url; as url) {
                    <h3 class="small-label">Original</h3>
                    <p><a [attr.href]="url" target="_blank" rel="noopener">{{ url }}</a></p>
                  }
                  @if (frontList('sources').length > 0) {
                    <h3 class="small-label">Sources</h3>
                    <ul class="links">
                      @for (source of frontList('sources'); track source) {
                        <li><a routerLink="/wiki" [queryParams]="pageParams(source)">{{ normalize(source) }}</a></li>
                      }
                    </ul>
                  }
                  @if (frontList('trails').length > 0) {
                    <h3 class="small-label">Trails</h3>
                    <ul class="links">
                      @for (slug of frontList('trails'); track slug) {
                        <li><a routerLink="/wiki" [queryParams]="pageParams(trail(slug))">{{ slug }}</a></li>
                      }
                    </ul>
                  }
                  @if ((current.backlinks ?? []).length > 0) {
                    <h3 class="small-label">Linked from</h3>
                    <ul class="links">
                      @for (link of current.backlinks ?? []; track link.source) {
                        @if (link.source) {
                          <li><a routerLink="/wiki" [queryParams]="pageParams(link.source)">{{ link.title || link.source }}</a></li>
                        }
                      }
                    </ul>
                  }
                </aside>
              </div>

              <section class="history" aria-label="History">
                <h3>History</h3>
                @if (history().length === 0) {
                  <p class="muted">No commits recorded for this file.</p>
                } @else {
                  <ol>
                    @for (commit of history(); track commit.hash) {
                      <li>
                        <span class="when"><den-local-time [value]="commit.date" [relative]="false" /></span>
                        <span class="author">{{ commit.author }}</span>
                        <span class="subject">{{ commit.summary }}</span>
                        @switch (commit.tag.kind) {
                          @case ('trail') {
                            @if (commit.tag.kind === 'trail') {
                              <a class="badge" routerLink="/wiki" [queryParams]="pageParams(trail(commit.tag.slug))">trail:{{ commit.tag.slug }}</a>
                            }
                          }
                          @case ('ui') { <span class="badge warn" title="Edited in the OpenKnowledge UI">ui</span> }
                          @case ('ui-format') { <span class="badge" title="Re-saved by the OpenKnowledge editor, formatting only">ui:format</span> }
                        }
                        <code class="hash">{{ commit.shortHash }}</code>
                      </li>
                    }
                  </ol>
                }
              </section>
            } @else if (!failure(store.page())) {
              <p class="muted">Loading {{ openPath() }}…</p>
            }
          } @else if (params().view === 'curation') {
            @if (failure(store.curationScan()); as error) {
              <p class="notice danger" role="alert">The curation scan failed ({{ errorText(error) }}).</p>
            }
            @if (scan(); as result) {
              <den-rich-markdown [content]="linkPaths(result.summary_markdown)" [policy]="linkPolicy()" (linkActivated)="followLink($event)" />
            } @else if (!failure(store.curationScan())) {
              <p class="muted">Running the curation scan…</p>
            }
          } @else {
            <div class="intro">
              <h3>Reading den-wiki</h3>
              <p>Pick a page, source or trail on the left, browse by tag, or search. Citations and links open here; every read is live from den-wiki.</p>
              <p class="muted">This viewer cannot change the wiki. Agents write through den-wiki’s MCP and CLI, and edits by hand stay in the OpenKnowledge UI.</p>
            </div>
          }
        </article>
      </div>
    </section>
  `,
})
export class WikiPanelComponent {
  protected readonly store = inject(WIKI_STORE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly views = views;

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly params = computed(() => {
    const map = this.queryParams();
    const raw = map.get('view');
    const view: WikiView = isWikiView(raw) ? raw : 'wiki';
    const zone = wikiZoneOf(map.get('folder') ?? '');
    const folder = zone && zone === view ? (map.get('folder') ?? view) : view;
    return { view, folder, tag: map.get('tag') ?? '', q: map.get('q') ?? '', path: map.get('path') ?? '' };
  });

  protected readonly openPath = computed(() => {
    const path = this.params().path;
    return path ? normalizeWikiPath(path) : '';
  });

  protected readonly page = computed(() => {
    const value = stateValue(this.store.page());
    return value && normalizeWikiPath(value.path) === this.openPath() ? value : undefined;
  });
  protected readonly body = computed(() => {
    const page = this.page();
    return page ? withoutLeadingTitle(stripFrontmatter(page.content), this.titleOf(page)) : '';
  });
  protected readonly facts = computed(() => wikiFacts(this.page()?.frontmatter));
  protected readonly history = computed(() => (this.page()?.project_history ?? []).map(wikiCommitView));
  protected readonly listing = computed(() => {
    const value = stateValue(this.store.listing());
    return value ? wikiListing(value) : undefined;
  });
  protected readonly searchResult = computed(() => stateValue(this.store.search()));
  protected readonly taxonomy = computed(() => stateValue(this.store.taxonomy()));
  protected readonly scan = computed(() => stateValue(this.store.curationScan()));

  protected readonly linkPolicy = computed((): RichMarkdownLinkPolicy => {
    const from = this.openPath();
    return {
      internal: (href) => resolveWikiHref(href, from).kind === 'page',
      href: (href) => {
        const target = resolveWikiHref(href, from);
        if (target.kind === 'external') return target.url;
        return this.router.serializeUrl(this.router.createUrlTree(['/wiki'], { queryParams: this.pageParams(target.path) }));
      },
    };
  });

  constructor() {
    // The store reads its own state when it starts a load; untracked keeps
    // these effects keyed to the URL alone.
    effect(() => {
      const path = this.openPath();
      if (path) untracked(() => void this.store.openPage(path));
    });
    effect(() => {
      const params = this.params();
      untracked(() => this.loadBrowse(params));
    });
  }

  private loadBrowse({ view, folder, q }: { readonly view: WikiView; readonly folder: string; readonly q: string }): void {
    if (view === 'tags') void this.store.loadTaxonomy();
    else if (view === 'curation') void this.store.loadCurationScan();
    else if (view === 'search') {
      if (q) void this.store.runSearch(q);
    } else void this.store.openFolder(folder);
  }

  protected viewParams(view: WikiView): Params {
    return { view };
  }

  /** Opens a page while keeping the browse pane where it is. */
  protected pageParams(path: string): Params {
    const { view, folder, tag, q } = this.params();
    return {
      view,
      folder: folder === view ? null : folder,
      tag: tag || null,
      q: q || null,
      path: normalizeWikiPath(path),
    };
  }

  protected followLink(href: string): void {
    const target = resolveWikiHref(href, this.openPath());
    if (target.kind === 'page') void this.router.navigate(['/wiki'], { queryParams: this.pageParams(target.path) });
  }

  protected submitSearch(event: Event, query: string): void {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    void this.router.navigate(['/wiki'], { queryParams: { view: 'search', q, path: this.openPath() || null } });
  }

  protected reload(): void {
    const path = this.openPath();
    if (path) void this.store.openPage(path);
    this.loadBrowse(this.params());
  }

  protected tagPages(taxonomy: DenWikiTaxonomyResult, tag: string): readonly string[] {
    if (tag.startsWith('type:')) {
      return taxonomy.types?.find((entry) => entry.name === tag.slice(5))?.pages ?? [];
    }
    const entry = [...(taxonomy.tags ?? []), ...(taxonomy.unlisted_tags ?? [])].find((candidate) => candidate.name === tag);
    return entry?.pages ?? [];
  }

  protected frontList(key: string): readonly string[] {
    return wikiList(this.page()?.frontmatter, key);
  }

  protected titleOf(page: DenWikiReadResult): string {
    return page.frontmatter?.title ? wikiTitle(page.path, page.frontmatter) : page.title || wikiTitle(page.path);
  }

  protected titleFromPath(path: string): string {
    return wikiTitle(path);
  }

  protected zoneLabel(path: string): string {
    const zone = wikiZoneOf(path);
    return WIKI_ZONES.find((item) => item.zone === zone)?.label ?? 'Wiki';
  }

  protected parentFolder(folder: string): string | null {
    return wikiParentFolder(folder);
  }

  protected normalize(path: string): string {
    return normalizeWikiPath(path);
  }

  protected linkPaths(markdown: string): string {
    return linkContentPaths(markdown);
  }

  protected trail(slug: string): string {
    return trailPath(slug);
  }

  protected failure<T>(state: AsyncState<T>): ClassifiedError | null {
    return state.kind === 'error' ? state.error : null;
  }

  protected errorText(error: ClassifiedError): string {
    return `${error.kind}: ${error.message}`;
  }
}
