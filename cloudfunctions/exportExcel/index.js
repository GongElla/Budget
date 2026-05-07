const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function generateCSV(records) {
  const BOM = '\uFEFF';
  let csv = BOM + '日期,类型,主分类,子分类,金额,备注\n';

  records.forEach(r => {
    const date = new Date(r.date);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const typeStr = r.type === 'income' ? '收入' : '支出';
    const subCategory = r.subCategory || '';
    const note = (r.note || '').replace(/"/g, '""');

    csv += `${dateStr},${typeStr},${r.category},${subCategory},${r.amount},"${note}"\n`;
  });

  return csv;
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

    const csvContent = generateCSV(records);
    const buffer = Buffer.from(csvContent, 'utf-8');

    const fileName = `ledger_${openid}_${Date.now()}.csv`;
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
