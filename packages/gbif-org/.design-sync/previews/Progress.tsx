import { Progress } from 'new-gbif-org-ts';

export const DataQualityScore = () => (
  <div className="g-max-w-md g-flex g-flex-col g-gap-2">
    <div className="g-flex g-justify-between g-text-sm">
      <span>Naturalis Biodiversity Center</span>
      <span>92%</span>
    </div>
    <Progress value={92} />
  </div>
);

export const MultipleMetrics = () => (
  <div className="g-max-w-md g-flex g-flex-col g-gap-3">
    <div className="g-flex g-flex-col g-gap-1">
      <div className="g-flex g-justify-between g-text-sm">
        <span>Human observation</span>
        <span>62%</span>
      </div>
      <Progress value={62} />
    </div>
    <div className="g-flex g-flex-col g-gap-1">
      <div className="g-flex g-justify-between g-text-sm">
        <span>Preserved specimen</span>
        <span>31%</span>
      </div>
      <Progress value={31} />
    </div>
    <div className="g-flex g-flex-col g-gap-1">
      <div className="g-flex g-justify-between g-text-sm">
        <span>Material sample</span>
        <span>7%</span>
      </div>
      <Progress value={7} />
    </div>
  </div>
);

export const DownloadProgress = () => (
  <div className="g-max-w-md g-flex g-flex-col g-gap-2">
    <div className="g-flex g-justify-between g-text-sm">
      <span>Preparing download archive</span>
      <span>48%</span>
    </div>
    <Progress value={48} />
  </div>
);
