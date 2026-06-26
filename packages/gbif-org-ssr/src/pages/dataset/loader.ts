// DATA LOADING — no formatting, no presentation. Just fetch the raw GraphQL data.
import { GraphQLService } from '../../lib/graphql';
import { config } from '../../lib/config';
import { DATASET_QUERY, type DatasetQueryResult, type RawDataset } from './query';

export type LoadResult =
  | { status: 'ok'; dataset: RawDataset }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export async function loadDataset(key: string, signal?: AbortSignal): Promise<LoadResult> {
  const gql = new GraphQLService({
    endpoint: config.graphqlEndpoint,
    locale: config.defaultLocale,
    signal,
  });

  try {
    const { data, errors } = await gql.query<DatasetQueryResult>(DATASET_QUERY, { key });
    if (errors?.length) {
      // The GBIF API reports a missing dataset as a 404 error on the `dataset` path
      // rather than a null field — treat that as notFound, everything else as error.
      const isNotFound = errors.some(
        (e) => /\b404\b|not found/i.test(e.message) && e.path?.includes('dataset')
      );
      if (isNotFound) return { status: 'notFound' };
      return { status: 'error', message: errors.map((e) => e.message).join('; ') };
    }
    if (!data?.dataset) return { status: 'notFound' };
    return { status: 'ok', dataset: data.dataset };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
