import { getEnumStatus } from './components/enum';
import { getInterpretationRemarkStatus } from './components/interpretationRemark';
import { getPoolStats } from '@/requestPools';

export default (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=5'); // 5 seconds
    res.json({
      enums: getEnumStatus(),
      interpetationRemark: getInterpretationRemarkStatus(),
      // Per-upstream bulkhead depth/limits. During an incident this shows which
      // pool is backed up (high `waiting`) vs which upstream is just slow.
      requestPools: getPoolStats(),
    });
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
};
