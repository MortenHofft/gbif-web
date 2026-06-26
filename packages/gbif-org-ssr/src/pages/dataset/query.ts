// The GraphQL query + result types for the dataset detail page.
// Hand-written for the slice; this is exactly what graphql-codegen would generate
// types for later (see packages/gbif-org/codegen.ts). Trimmed to the fields the
// About tab + header actually use.
export const DATASET_QUERY = /* GraphQL */ `
  query Dataset($key: ID!) {
    dataset(key: $key) {
      key
      title
      type
      created
      modified
      pubDate
      description
      purpose
      homepage
      logoUrl
      license
      publishingOrganizationKey
      publishingOrganizationTitle
      geographicCoverages {
        description
      }
      taxonomicCoverages {
        description
      }
      contactsCitation {
        key
        abbreviatedName
        roles
      }
    }
  }
`;

export type RawDataset = {
  key: string;
  title: string;
  type: string;
  created: string | null;
  modified: string | null;
  pubDate: string | null;
  description: string | null;
  purpose: string | null;
  homepage: string | null;
  logoUrl: string | null;
  license: string | null;
  publishingOrganizationKey: string | null;
  publishingOrganizationTitle: string | null;
  geographicCoverages: Array<{ description: string | null }> | null;
  taxonomicCoverages: Array<{ description: string | null }> | null;
  contactsCitation: Array<{
    key: string | null;
    abbreviatedName: string | null;
    roles: string[] | null;
  }> | null;
};

export type DatasetQueryResult = { dataset: RawDataset | null };
