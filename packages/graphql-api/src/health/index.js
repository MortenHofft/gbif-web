import { getEnumStatus } from './components/enum';
import { getInterpretationRemarkStatus } from './components/interpretationRemark';
import { isShuttingDown } from '../lifecycle';

export default (req, res) => {
  // While draining, fail the probe so the load balancer stops sending traffic
  // here and lets in-flight requests finish on this instance.
  if (isShuttingDown()) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ status: 'shutting_down' });
    return;
  }

  try {
    res.setHeader('Cache-Control', 'public, max-age=5'); // 5 seconds
    res.json({
      enums: getEnumStatus(),
      interpetationRemark: getInterpretationRemarkStatus(),
    });
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
};
