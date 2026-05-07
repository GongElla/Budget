const padZero = n => (n < 10 ? '0' + n : '' + n);

const formatTime = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}:${padZero(second)}`;
};

const formatDate = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${padZero(month)}-${padZero(day)}`;
};

const formatMonth = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${padZero(month)}`;
};

const formatAmount = amount => parseFloat(amount).toFixed(2);

const generateInviteCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const getMonthFromDate = dateStr => formatMonth(new Date(dateStr));

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

module.exports = {
  formatTime,
  formatDate,
  formatMonth,
  padZero,
  formatAmount,
  generateInviteCode,
  getMonthRange,
  getMonthFromDate,
  DEFAULT_SUB_CATEGORIES
};
