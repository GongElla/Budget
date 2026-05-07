const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { familyId, startDate, endDate } = event;

  try {
    const familyRes = await db.collection('families').doc(familyId).get();
    const family = familyRes.data;

    if (!family) {
      return { totalIncome: '0.00', totalExpense: '0.00', categoryStats: [], memberStats: [] };
    }

    const query = {
      familyId,
      date: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    };

    const recordsRes = await db.collection('records').where(query).get();
    const records = recordsRes.data;

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = {};
    const memberMap = {};

    for (const r of records) {
      const amt = parseFloat(r.amount) || 0;
      if (r.type === 'income') totalIncome += amt;
      else totalExpense += amt;

      const cat = r.category;
      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, amount: 0 };
      categoryMap[cat].amount += amt;

      const memberId = r.openid;
      if (!memberMap[memberId]) memberMap[memberId] = { openid: memberId, amount: 0 };
      memberMap[memberId].amount += amt;
    }

    const categoryStats = Object.values(categoryMap)
      .sort((a, b) => b.amount - a.amount)
      .map(item => ({
        ...item,
        amountStr: item.amount.toFixed(2),
        percent: totalExpense > 0 ? ((item.amount / totalExpense) * 100).toFixed(1) : '0.0'
      }));

    const memberOpenids = Object.keys(memberMap);
    let memberStats = [];

    if (memberOpenids.length > 0) {
      const usersRes = await db.collection('users')
        .where({ _openid: _.in(memberOpenids) })
        .get();

      const userMap = {};
      usersRes.data.forEach(u => { userMap[u._openid] = u; });

      memberStats = Object.values(memberMap)
        .sort((a, b) => b.amount - a.amount)
        .map(item => ({
          ...item,
          nickName: userMap[item.openid]?.nickName || '未知用户',
          avatarUrl: userMap[item.openid]?.avatarUrl || '',
          amountStr: item.amount.toFixed(2)
        }));
    }

    return {
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      categoryStats,
      memberStats
    };
  } catch (err) {
    console.error('家庭统计失败', err);
    return { totalIncome: '0.00', totalExpense: '0.00', categoryStats: [], memberStats: [] };
  }
};
