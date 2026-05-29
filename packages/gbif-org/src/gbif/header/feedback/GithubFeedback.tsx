import { pathnameAtom, searchParamsAtom } from '@/atoms/urlAtoms';
import { useConfig } from '@/config/config';
import { useStore } from 'jotai';
import { FormattedMessage } from 'react-intl';
import { MdMailOutline, MdOpenInNew } from 'react-icons/md';

interface GithubFeedbackProps {
  onClose: () => void;
}

export function GithubFeedback({ onClose }: GithubFeedbackProps) {
  const store = useStore();
  const { feedback } = useConfig();
  const { githubRepo, githubUsernames = [] } = feedback || {};

  // Read URL via the jotai store imperatively — no subscription, so this
  // component doesn't rerender on URL changes (it's inside the feedback
  // popover; the URL captured here is only used in the href).
  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.toString()
      : `${store.get(pathnameAtom)}?${store.get(searchParamsAtom).toString()}`;

  // Prepare the issue body
  let issueBody = `**Page**: ${currentUrl}\n`;
  if (feedback?.githubMessage) {
    issueBody = `${feedback.githubMessage}\n\n${issueBody}`;
  }
  if (githubUsernames.length > 0) {
    issueBody += `${githubUsernames.map((username) => `@${username}`).join(', ')}\n\n`;
  }

  const githubUrl = `${githubRepo}/issues/new?` + `body=${encodeURIComponent(issueBody)}`;
  return (
    <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="g-block g-w-full g-p-4 g-text-start g-border g-rounded-lg g-bg-gray-50 hover:g-bg-gray-100 g-transition-colors"
    >
      <h4 className="g-font-medium g-mb-1">
        <FormattedMessage id="feedback.leaveIssueOnGithub" defaultMessage="Leave issue on GitHub" />
        <MdOpenInNew className="g-ms-2 g-h-4 g-w-4" />
      </h4>
      <p className="g-text-sm g-text-muted-foreground">
        <FormattedMessage
          id="feedback.contactUsDescription"
          defaultMessage="For website issues, data processing problems, or general questions"
        />
      </p>
      <span className="g-text-xs g-text-orange-500">
        <FormattedMessage
          id="feedback.requiresGithubAccount"
          defaultMessage="Requires a Github account"
        />
      </span>
    </a>
  );
}

export function MailFeedback({ onClose }: GithubFeedbackProps) {
  const store = useStore();
  const { feedback } = useConfig();
  const { contactEmail } = feedback || {};
  if (!contactEmail) return null;

  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.toString()
      : `${store.get(pathnameAtom)}?${store.get(searchParamsAtom).toString()}`;

  return (
    <a
      href={`mailto:${contactEmail}?body=${encodeURIComponent(currentUrl)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="g-block g-w-full g-p-4 g-text-start g-border g-rounded-lg g-bg-gray-50 hover:g-bg-gray-100 g-transition-colors"
    >
      <h4 className="g-font-medium g-mb-1">
        <FormattedMessage id="feedback.sendUsAnEmail" defaultMessage="Send us an email" />
        <MdMailOutline className="g-ms-2 g-h-4 g-w-4" />
      </h4>
      <p className="g-text-sm g-text-muted-foreground">
        <FormattedMessage
          id="feedback.forPrivateEnquiries"
          defaultMessage="For private enquiries or if you do not have a Github account."
        />
      </p>
    </a>
  );
}
