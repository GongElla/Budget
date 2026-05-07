const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function getMonthStartEnd(year, month) {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999)
  };
}

exports.main = async (event, context) => {
  const { openid, familyId, type, startDate, endDate } = event;

  try {
    const query = {
      type,
      date: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    };
    if (familyId) {
      query.familyId = familyId;
    } else {
      query.openid = openid;
    }

    const recordsRes = await db.collection('records').where(query).get();
    const records = recordsRes.data;

    const total = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const count = records.length;
    const avg = count > 0 ? total / count : 0;

    const categoryMap = {};
    records.forEach(r => {
      const cat = r.category;
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, amount: 0, count: 0 };
      }
      categoryMap[cat].amount += (parseFloat(r.amount) || 0);
      categoryMap[cat].count += 1;
    });

    const colors = ['#07c160', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];
    const categoryStats = Object.values(categoryMap)
      .sort((a, b) => b.amount - a.amount)
      .map((item, index) => ({
        ...item,
        amountStr: item.amount.toFixed(2),
        percent: total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0.0',
        color: colors[index % colors.length]
      }));

    // 近6个月趋势（修复跨年月份计算）
    const start = new Date(startDate);
    const baseYear = start.getFullYear();
    const baseMonth = start.getMonth();

    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = baseMonth - i;
      const year = baseYear + Math.floor(targetMonth / 12);
      const month = ((targetMonth % 12) + 12) % 12;
      const { start: monthStart, end: monthEnd } = getMonthStartEnd(year, month);

      const monthQuery = {
        type,
        date: _.gte(monthStart).and(_.lte(monthEnd))
      };
      if (familyId) {
        monthQuery.familyId = familyId;
      } else {
        monthQuery.openid = openid;
      }

      const monthRes = await db.collection('records').where(monthQuery).get();
      const monthTotal = monthRes.data.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

      trendData.push({
        month: `${month + 1}月`,
        amount: monthTotal,
        amountStr: monthTotal.toFixed(2)
      });
    }

    return {
      total: total.toFixed(2),
      count,
      avg: avg.toFixed(2),
      categoryStats,
      trendData
    };
  } catch (err) {
    console.error('统计失败', err);
    return {
      total: '0.00',
      count: 0,
      avg: '0.00',
      categoryStats: [],
      trendData: []
    };
  }
};
