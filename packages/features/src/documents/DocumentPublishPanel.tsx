import { useCallback, useMemo, useState } from 'react';
import type { DocumentPublicationResponse } from '@den-web/api/client';
import { previewDocumentPublication, publishDocument } from '@den-web/api/client';
import type { Document } from '@den-web/api/types';
import { normalizeDocumentPublishTimestamp } from './documentPublishTimestamp';

interface Props {
  document: Document;
  onClose: () => void;
}

type PublishState = 'idle' | 'previewing' | 'ready' | 'publishing' | 'published' | 'error';

export function DocumentPublishPanel({ document, onClose }: Props) {
  const [overwrite, setOverwrite] = useState(false);
  const [state, setState] = useState<PublishState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPublicationResponse | null>(null);
  const [published, setPublished] = useState<DocumentPublicationResponse | null>(null);

  const request = useMemo(() => ({
    source: {
      project_id: document.project_id,
      document_project_id: document.project_id,
      document_slug: document.slug,
    },
    options: {
      tags: document.tags ?? [],
      overwrite,
    },
    requested_by: 'den-web',
    document: {
      title: document.title,
      slug: document.slug,
      markdown: document.content,
      updated_at: normalizeDocumentPublishTimestamp(document.updated_at),
    },
  }), [document, overwrite]);

  const handlePreview = useCallback(async () => {
    setState('previewing');
    setError(null);
    setPublished(null);
    try {
      const response = await previewDocumentPublication(request);
      setPreview(response);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [request]);

  const handlePublish = useCallback(async () => {
    setState('publishing');
    setError(null);
    try {
      const response = await publishDocument(request);
      setPublished(response);
      setPreview(response);
      setState('published');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [request]);

  const busy = state === 'previewing' || state === 'publishing';
  const canPublish = preview !== null && (state === 'ready' || state === 'published' || state === 'error');

  return (
    <div className="document-publish-panel" role="region" aria-label="Document blog publishing">
      <div className="document-publish-header">
        <div>
          <h3>Share via blog</h3>
        </div>
        <button
          type="button"
          className="discussion-reply-cancel"
          onClick={onClose}
          disabled={busy}
          aria-label="Close publish panel"
        >
          x
        </button>
      </div>

      <label className="document-publish-toggle">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={event => {
            setOverwrite(event.target.checked);
            setPreview(null);
            setPublished(null);
            setError(null);
            setState('idle');
          }}
          disabled={busy}
        />
        Overwrite an existing generated post at the same path
      </label>

      <div className="document-publish-actions">
        <button
          type="button"
          className="detail-action"
          onClick={() => void handlePreview()}
          disabled={busy}
        >
          {state === 'previewing' ? 'Previewing...' : 'Preview'}
        </button>
        <button
          type="button"
          className="detail-action detail-action-primary"
          onClick={() => void handlePublish()}
          disabled={busy || !canPublish}
        >
          {state === 'publishing' ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      {error && <div className="detail-error" role="alert">Publish failed: {error}</div>}
      {published && <PublishedResult result={published} />}
      {preview && <PreviewResult result={preview} />}
    </div>
  );
}

function PublishedResult({ result }: { result: DocumentPublicationResponse }) {
  return (
    <div className="detail-info document-publish-result" role="status">
      Published to <a href={result.public_url} target="_blank" rel="noreferrer">{result.public_url}</a>
      {result.git_commit && <span className="document-publish-commit">commit {result.git_commit.slice(0, 12)}</span>}
    </div>
  );
}

function PreviewResult({ result }: { result: DocumentPublicationResponse }) {
  return (
    <div className="document-publish-preview">
      <dl className="detail-meta">
        <dt>Post path</dt>
        <dd>{result.post_path}</dd>
        <dt>Public URL</dt>
        <dd>{result.public_url}</dd>
      </dl>
      {result.warnings && result.warnings.length > 0 && (
        <div className="document-publish-warnings">{result.warnings.join(' ')}</div>
      )}
      {result.preview_markdown && (
        <pre className="document-publish-markdown">{result.preview_markdown}</pre>
      )}
    </div>
  );
}
