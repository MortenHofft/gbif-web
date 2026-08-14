import { useStringParam } from '@/hooks/useParam';
import { PredicateDisplay } from '../key/predicate';
import Editor from './editor';
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validatePredicate, ValidationResponse } from './validate';
import { FormattedMessage, useIntl } from 'react-intl';
import { getOriginalPredicate } from './usePredicate';

//a hook to store content in textarea. per default it should store to url, but if above 1200 characters then use session storage instead
export function useTextAreaContent(key: string): [string, (text: string) => void] {
  const [param, setParam] = useStringParam({ key, replace: true });
  const sessionStorageKey = `textarea-${key}`;
  const sessionValue = window.sessionStorage.getItem(sessionStorageKey) ?? '';

  const setValue = useCallback(
    (text: string) => {
      if (text.length > 1200) {
        window.sessionStorage.setItem(sessionStorageKey, text);
        setParam(undefined);
      } else {
        window.sessionStorage.removeItem(sessionStorageKey);
        setParam(text);
      }
    },
    [sessionStorageKey, setParam]
  );

  return [param || sessionValue, setValue];
}

export function setTextAreaContentStorageDirectly(key: string, text: string) {
  const sessionStorageKey = `textarea-${key}`;
  window.sessionStorage.setItem(sessionStorageKey, text);
}

export default function PredicateEditor({
  onContinue,
}: {
  onContinue: (predicate: string) => void;
}) {
  const [searchParams] = useSearchParams();
  const [variablesId, setVariablesId] = useStringParam({ key: 'variablesId', replace: true });
  const [predicate, setPredicate] = useTextAreaContent('predicate');
  const predicateFetchedRef = useRef(false);
  const { formatMessage } = useIntl();

  // wrap this so it doesn't fail on server side rendering
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  let source = searchParams.get('source');
  try {
    const referrerUrl = new URL(referrer);
    // if source name undefined, then overwrite with referrer hostname
    source = referrerUrl.hostname ?? source;
  } catch (e) {
    // ignore invalid referrer url
  }
  sessionStorage.setItem('downloadSource', source ?? 'unknown');

  useEffect(() => {
    if (!searchParams.get('variablesId')) return;
    const controller = new AbortController();

    const initialize = async () => {
      try {
        const predicateFromQueryId = await getOriginalPredicate(searchParams, controller.signal);
        if (controller.signal.aborted || !predicateFromQueryId) return;
        predicateFetchedRef.current = true;
        setPredicate(predicateFromQueryId);
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error('Failed to load predicate from variablesId:', e);
        }
      }
    };

    initialize();
    return () => controller.abort();
  }, [searchParams, setPredicate]);

  // Clear variablesId from the URL after the predicate has been loaded from a fetch.
  // The ref guard prevents this from firing on mount when stale sessionStorage already
  // has a predicate — in that case the fetch hasn't run yet and variablesId must stay
  // in the URL. Without the guard, two concurrent setSearchParams calls (one from
  // setPredicate, one from setVariablesId) would race and the predicate URL param
  // would be lost before React Router could commit it.
  useEffect(() => {
    if (predicate && variablesId && predicateFetchedRef.current) {
      predicateFetchedRef.current = false;
      setVariablesId(undefined);
    }
  }, [predicate, variablesId, setVariablesId]);

  const handleFormat = useCallback(
    async (text: string): Promise<ValidationResponse> => {
      try {
        const obj = JSON.parse(text);
        return { text: JSON.stringify(obj, null, 2) };
      } catch (error) {
        return {
          error: {
            type: 'invalid',
            message: formatMessage({
              id: 'download.predicate.invalidJson',
              defaultMessage: 'The provided predicate is not valid JSON',
            }),
          },
        };
      }
    },
    [formatMessage]
  );

  const handleValidation = useCallback(
    (str: string) => validatePredicate(str, formatMessage),
    [formatMessage]
  );

  return (
    <Editor
      title={<FormattedMessage id="download.predicateEditor" />}
      documentationUrl="https://techdocs.gbif.org/en/data-use/api-sql-downloads"
      PrettyDisplay={PredicateVisual}
      onContinue={onContinue}
      text={predicate ?? ''}
      setText={setPredicate}
      handleFormat={handleFormat}
      handleValidation={handleValidation}
      placeholder={formatMessage({ id: 'download.request.placeholder' })}
    />
  );
}

function PredicateVisual({ content }: { content: string; onError: (error: Error) => void }) {
  return (
    <div className="gbif-predicates">
      <PredicateDisplay predicate={content} />
    </div>
  );
}
