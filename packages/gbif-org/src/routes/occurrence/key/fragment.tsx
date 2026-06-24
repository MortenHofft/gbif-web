import { NotFoundLoaderResponse } from '@/errors';
import { OccurrenceExistsQuery, OccurrenceExistsQueryVariables } from '@/gql/graphql';
import { DynamicLink, LoaderArgs } from '@/reactRouterPlugins';
import { ArticleIntro } from '@/routes/resource/key/components/articleIntro';
import { ArticlePreTitle } from '@/routes/resource/key/components/articlePreTitle';
import { ArticleTextContainer } from '@/routes/resource/key/components/articleTextContainer';
import { ArticleTitle } from '@/routes/resource/key/components/articleTitle';
import { PageContainer } from '@/routes/resource/key/components/pageContainer';
import { required } from '@/utils/required';
import { FormattedMessage } from 'react-intl';
import { redirect, useLoaderData, useParams } from 'react-router-dom';
import formatXml from 'xml-formatter';

type LoaderResult = string;

const OCCURRENCE_EXISTS_QUERY = /* GraphQL */ `
  query OccurrenceExists($key: ID!) {
    occurrence(key: $key) {
      key
    }
  }
`;

export async function occurrenceFragmentLoader({
  params,
  config,
  graphql,
}: LoaderArgs): Promise<LoaderResult | Response> {
  const key = required(params.key, 'No key was provided in the URL');

  // Run the existence check and the fragment fetch in parallel — for the common
  // case where the occurrence is gone (the whole point of the fragment page), this
  // saves one sequential round-trip. If it turns out the occurrence exists we
  // redirect and the already-started fragment fetch is simply discarded.
  const [gqlResponse, fragmentResponse] = await Promise.all([
    graphql.query<OccurrenceExistsQuery, OccurrenceExistsQueryVariables>(
      OCCURRENCE_EXISTS_QUERY,
      { key }
    ),
    fetch(`${config.v1Endpoint}/occurrence/${key}/fragment`),
  ]);

  const gqlResult = await gqlResponse.json();
  if (gqlResult.data.occurrence != null) {
    return redirect(`/occurrence/${key}`);
  }

  const response = fragmentResponse;

  // If there is no fragment, return a 404
  if (!response.ok) throw new NotFoundLoaderResponse();

  // The response could either be of type JSON or XML, but the Content-Type header does not differentiate
  const text = await response.text();
  const isJson = text.startsWith('{');

  if (isJson) return JSON.stringify(JSON.parse(text), null, 4);
  return formatXml(text);
}

export function OccurrenceFragment() {
  const fragment = useLoaderData() as LoaderResult;
  const { key } = useParams();

  return (
    <article>
      <PageContainer topPadded bottomPadded className="g-bg-white">
        <ArticleTextContainer>
          <ArticlePreTitle clickable>
            <DynamicLink pageId="occurrenceSearch">
              <FormattedMessage id="occurrenceDetails.occurrence" defaultMessage="Occurrence" />
            </DynamicLink>
          </ArticlePreTitle>
          <ArticleTitle>
            <FormattedMessage id="occurrenceDetails.occurrence" defaultMessage="Occurrence" /> {key}
          </ArticleTitle>
          <ArticleIntro>
            <p className="g-text-red-500 g-text-base g-font-medium g-pb-2">
              <FormattedMessage
                id="occurrenceDetails.deletedMessage"
                defaultMessage="This record has been deleted."
              />
            </p>
            <p className="g-text-base">
              <FormattedMessage
                id="occurrenceDetails.deletedDescription"
                defaultMessage="This record has been deleted."
              />
            </p>
          </ArticleIntro>
        </ArticleTextContainer>
        <div className="g-py-8">
          <pre className="g-bg-slate-100 g-p-4 md:g-p-8 g-w-full g-max-w-7xl g-m-auto g-overflow-auto">
            {fragment}
          </pre>
        </div>
      </PageContainer>
    </article>
  );
}
