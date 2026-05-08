const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function generateXLS(records) {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>td,th{border:1px solid #ccc;padding:6px;text-align:left;}th{background:#f2f2f2;}</style></head><body><table>';
  html += '<tr><th>日期</th><th>类型</th><th>主分类</th><th>子分类</th><th>金额</th><th>备注</th></tr>';

  records.forEach(r => {
    const date = new Date(r.date);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const typeStr = r.type === 'income' ? '收入' : '支出';
    html += `<tr><td>${dateStr}</td><td>${typeStr}</td><td>${r.category}</td><td>${r.subCategory || ''}</td><td>${r.amount}</td><td>${r.note || ''}</td></tr>`;
  });

  html += '</table></body></html>';
  return html;
}

exports.main = async (event, context) => {
  const { openid, startMonth, endMonth } = event;

  try {
    const startDate = new Date(startMonth + '-01');
    const [endYear, endMonthNum] = endMonth.split('-').map(Number);
    const endDate = new Date(endYear, endMonthNum, 0, 23, 59, 59, 999);

    const recordsRes = await db.collection('records')
      .where({
        openid,
        date: _.gte(startDate).and(_.lte(endDate))
      })
      .orderBy('date', 'asc')
      .get();

    const records = recordsRes.data;

    if (records.length === 0) {
      return { success: false, message: '该时间段内没有记录' };
    }

    const xlsContent = generateXLS(records);
    const buffer = Buffer.from(xlsContent, 'utf-8');

    const fileName = `ledger_${openid}_${Date.now()}.xls`;
    const uploadRes = await cloud.uploadFile({
      cloudPath: `exports/${fileName}`,
      fileContent: buffer
    });

    return {
      success: true,
      fileID: uploadRes.fileID,
      recordCount: records.length
    };
  } catch (err) {
    console.error('导出失败', err);
    return { success: false, message: '导出失败' };
  }
};
