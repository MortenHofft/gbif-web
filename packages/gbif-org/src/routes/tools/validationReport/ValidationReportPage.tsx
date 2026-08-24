import { Card } from '@/components/ui/largeCard';
import { ArticleTextContainer } from '@/routes/resource/key/components/articleTextContainer';
import { PageContainer } from '@/routes/resource/key/components/pageContainer';
import { FormattedMessage } from 'react-intl';

export default function ValidationReportPage() {
  return (
    <PageContainer className="g-bg-slate-100 g-flex-1">
      <ArticleTextContainer className="g-pt-8 g-pb-12">
        <Card className="g-bg-white g-p-8">
          <p className="g-text-slate-600">
            <FormattedMessage
              id="tools.validationReport.comingSoon"
              defaultMessage="This tool is coming soon."
            />
          </p>
        </Card>
      </ArticleTextContainer>
    </PageContainer>
  );
}
