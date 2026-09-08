import { IdentifierTag, IdentifierType, IdentifierValue } from 'new-gbif-org-ts';

// IdentifierTag is the raw building block; DoiTag/OrcId/Lsid/LicenceTag/IucnTag
// compose it with a specific IdentifierType + IdentifierValue pair, but those
// wrappers aren't re-exported from the package barrel, so the real compositions
// are ported here directly (see src/components/identifierTag.tsx).

export const Doi = () => (
  <IdentifierTag as="a" href="https://doi.org/10.48580/dgykv">
    <IdentifierType>DOI</IdentifierType>
    <IdentifierValue>10.48580/dgykv</IdentifierValue>
  </IdentifierTag>
);

export const Orcid = () => (
  <a
    dir="ltr"
    className="g-inline-block g-no-underline"
    href="https://orcid.org/0000-0002-1825-0097"
  >
    <img
      alt="ORCID logo"
      className="g-me-1 g-inline-block"
      src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png"
      width="16"
      height="16"
    />
    https://orcid.org/0000-0002-1825-0097
  </a>
);

export const Lsid = () => (
  <IdentifierTag as="a" href="http://lsid.info/urn:lsid:biodiversity.org.au:afd.taxon:31d764a9">
    <IdentifierType>URN:LSID:</IdentifierType>
    <IdentifierValue>biodiversity.org.au:afd.taxon:31d764a9</IdentifierValue>
  </IdentifierTag>
);

export const Licence = () => (
  <IdentifierTag>
    <IdentifierType>Licence</IdentifierType>
    <IdentifierValue>CC BY 4.0</IdentifierValue>
  </IdentifierTag>
);

export const IucnStatus = () => (
  <IdentifierTag as="a" href="https://www.iucnredlist.org/search?query=Ctenophorus%20decresii">
    <IdentifierType className="g-bg-[#ed2a24] g-border-[#c1201b]">IUCN</IdentifierType>
    <IdentifierValue>Endangered</IdentifierValue>
  </IdentifierTag>
);

export const TagRow = () => (
  <div className="g-flex g-flex-wrap g-gap-2 g-items-center">
    <IdentifierTag as="a" href="https://doi.org/10.48580/dgykv">
      <IdentifierType>DOI</IdentifierType>
      <IdentifierValue>10.48580/dgykv</IdentifierValue>
    </IdentifierTag>
    <IdentifierTag>
      <IdentifierType>Licence</IdentifierType>
      <IdentifierValue>CC0 1.0</IdentifierValue>
    </IdentifierTag>
    <IdentifierTag as="a" href="https://www.iucnredlist.org/search?query=Ctenophorus%20decresii">
      <IdentifierType className="g-bg-[#ed2a24] g-border-[#c1201b]">IUCN</IdentifierType>
      <IdentifierValue>Critically Endangered</IdentifierValue>
    </IdentifierTag>
  </div>
);
