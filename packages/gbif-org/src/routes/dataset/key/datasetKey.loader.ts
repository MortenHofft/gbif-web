import { DatasetQuery, DatasetQueryVariables } from '@/gql/graphql';
import { LoaderArgs } from '@/reactRouterPlugins';
import { throwCriticalErrors } from '@/routes/rootErrorPage';
import { required } from '@/utils/required';
// Side-effect imports: register the fragments this module's loader query spreads. Tabs and
// shared components load lazily, so they cannot be relied on to have registered them first.
import '@/routes/resource/key/components/articleBanner';

const DATASET_QUERY = /* GraphQL */ `
  query Dataset($key: ID!) {
    literatureSearch(gbifDatasetKey: [$key]) {
      documents {
        total
      }
    }
    # totalTaxa: taxonSearch(datasetKey: [$key], origin: [SOURCE]) {
    #   count
    # }
    # accepted: taxonSearch(datasetKey: [$key], origin: [SOURCE], status: [ACCEPTED]) {
    #   count
    # }
    # synonyms: taxonSearch(
    #   datasetKey: [$key]
    #   origin: [SOURCE]
    #   status: [SYNONYM, HETEROTYPIC_SYNONYM, PROPARTE_SYNONYM, HOMOTYPIC_SYNONYM]
    # ) {
    #   count
    # }
    dataset(key: $key) {
      key
      checklistBankDataset {
        key
      }
      type
      title
      created
      modified
      deleted
      duplicateOfDataset {
        key
        title
      }
      dwca {
        extensions
      }
      pubDate
      description
      dataLanguage
      purpose
      temporalCoverages
      logoUrl
      publishingOrganizationKey
      publishingOrganizationTitle
      homepage
      additionalInfo
      acknowledgements
      installation {
        key
        title
        organization {
          key
          title
        }
      }
      volatileContributors(limit: 101) {
        key
        firstName
        lastName
        position
        organization
        address
        city
        postalCode
        province
        country
        userId
        email
        phone
        type
        _highlighted
        roles
      }
      contactsCitation {
        key
        abbreviatedName
        firstName
        lastName
        userId
        roles
      }
      geographicCoverages {
        description
        boundingBox {
          minLatitude
          maxLatitude
          minLongitude
          maxLongitude
          globalCoverage
        }
      }
      taxonomicCoverages {
        description
        coverages {
          scientificName
          commonName
          rank {
            interpreted
          }
        }
      }
      publishingOrganization {
        title
        homepage
        logoUrl
      }
      bibliographicCitations(limit: 201) {
        identifier
        text
      }
      samplingDescription {
        studyExtent
        sampling
        qualityControl
        methodSteps
      }
      dataDescriptions {
        charset
        name
        format
        formatVersion
        url
      }
      keywordCollections {
        thesaurus
        keywords
      }
      citation {
        text
      }
      license
      project {
        title
        abstract
        studyAreaDescription
        designDescription
        funding
        contacts {
          firstName
          lastName

          organization
          position
          roles
          type

          address
          city
          postalCode
          province
          country

          homepage
          email
          phone
          userId
        }
        identifier
        gbifProject {
          title
          primaryImage {
            ...ArticleBanner
          }
        }
      }
      endpoints {
        key
        type
        url
      }
      identifiers(limit: 50) {
        key
        type
        identifier
      }
      doi
      machineTags {
        namespace
        name
        value
      }
      localContexts {
        project_page
        title
        notice {
          name
          img_url
        }
        labels {
          name
          img_url
          communityName
        }
      }
      networks(visibleOnDatasetPage: true) {
        key
        title
      }
    }
  }
`;

export async function datasetLoader({ params, graphql }: LoaderArgs) {
  const key = required(params.key, 'No key was provided in the URL');

  const response = await graphql.query<DatasetQuery, DatasetQueryVariables>(DATASET_QUERY, { key });
  const { errors, data } = await response.json();

  throwCriticalErrors({
    path404: ['dataset'],
    errors,
    requiredObjects: [data?.dataset],
  });

  return {
    errors,
    data: {
      ...data,
      dataset: data.dataset!,
    },
  };
}

export type DatasetKeyLoaderResult = Awaited<ReturnType<typeof datasetLoader>>;
