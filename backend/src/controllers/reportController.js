const reportService = require('../services/reportService');

/**
 * GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&format=json|csv
 * format defaults to json. csv streams back a downloadable file with
 * the correct Content-Disposition header instead of a JSON body.
 */
async function getReport(req, res) {
  try {
    const { startDate, endDate, format } = req.query || {};

    let report;
    try {
      report = await reportService.getDateRangeReport(req.tenantId, startDate, endDate);
    } catch (err) {
      if (err instanceof RangeError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    if (format === 'csv') {
      // Prefix with a UTF-8 BOM so Excel renders the ₹ symbol correctly
      // instead of mangling it into garbled characters on Windows.
      const csv = `\uFEFF${reportService.toCSV(report)}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="saarthi-report-${report.startDate}_to_${report.endDate}.csv"`
      );
      return res.status(200).send(csv);
    }

    return res.status(200).json({ report });
  } catch (err) {
    console.error('get report error:', err);
    return res.status(500).json({ error: 'Something went wrong while building the report' });
  }
}

module.exports = { getReport };