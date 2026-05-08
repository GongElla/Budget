const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '通讯', '人情', '其他'];
const DEFAULT_INCOME_CATEGORIES = ['工资', '奖金', '投资收益', '兼职', '礼金', '退款', '其他'];

const DEFAULT_SUB_CATEGORIES = {
  '餐饮': ['零食', '饮料', '聚餐', '日常餐'],
  '交通': ['公交地铁', '打车', '加油', '停车', '保养'],
  '购物': ['服饰', '日用品', '电子产品', '美妆护肤'],
  '娱乐': ['电影', '游戏', '旅游', '运动'],
  '居住': ['房租/房贷', '水电燃气', '物业', '家居'],
  '医疗': ['药品', '挂号', '体检'],
  '教育': ['书籍', '课程', '培训'],
  '通讯': ['话费', '宽带'],
  '人情': ['礼品', '红包', '请客']
};

async function initCategories(openid) {
  const catCountRes = await db.collection('categories').where({ _openid: openid }).count();
  if (catCountRes.total > 0) return;

  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
    _openid: openid,
    type: 'expense',
    name,
    icon: '',
    sortOrder: index,
    isDefault: true
  }));

  const incomeCategories = DEFAULT_INCOME_CATEGORIES.map((name, index) => ({
    _openid: openid,
    type: 'income',
    name,
    icon: '',
    sortOrder: index,
    isDefault: true
  }));

  await Promise.all(
    [...expenseCategories, ...incomeCategories].map(cat =>
      db.collection('categories').add({ data: cat })
    )
  );
}

async function initSubCategories(openid) {
  const subCountRes = await db.collection('subCategories').where({ _openid: openid }).count();
  if (subCountRes.total > 0) return;

  const subCategories = [];
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const subs = DEFAULT_SUB_CATEGORIES[cat] || [];
    subs.forEach((name, index) => {
      subCategories.push({
        _openid: openid,
        parentCategory: cat,
        name,
        sortOrder: index
      });
    });
  }

  await Promise.all(
    subCategories.map(sub => db.collection('subCategories').add({ data: sub }))
  );
}

async function createUser(openid) {
  const userCountRes = await db.collection('users').where({ _openid: openid }).count();
  if (userCountRes.total > 0) return;

  await db.collection('users').add({
    data: {
      _id: openid,
      _openid: openid,
      nickName: '微信用户',
      avatarUrl: '',
      recordMode: 'detailed',
      familyId: '',
      role: 'none',
      createTime: new Date()
    }
  });
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  let user = null;
  try {
    const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
    if (res.data.length > 0) {
      user = res.data[0];
    }
  } catch (e) {
    // 查询失败
  }

  if (user && user.recordMode === 'simple') {
    await db.collection('users').doc(user._id).update({
      data: { recordMode: 'detailed' }
    });
    user.recordMode = 'detailed';
  }

  if (!user) {
    await Promise.all([
      initCategories(openid),
      initSubCategories(openid),
      createUser(openid)
    ]);

    user = {
      _openid: openid,
      nickName: '微信用户',
      avatarUrl: '',
      recordMode: 'detailed',
      familyId: '',
      role: 'none',
      createTime: new Date()
    };
  }

  return { openid, user };
};
