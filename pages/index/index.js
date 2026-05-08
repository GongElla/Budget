const app = getApp();
const { recordApi } = require('../../utils/db');
const { formatDate, formatMonth, formatAmount, getMonthRange } = require('../../utils/util');

Page({
  data: {
    currentMonth: '',
    income: 0,
    expense: 0,
    balance: 0,
    records: [],
    groupedRecords: [],
    allMonthRecords: [],
    recordMode: 'simple',
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false
  },

  async onLoad() {
    await app.loginPromise.catch(() => {});
    const currentMonth = formatMonth(new Date());
    this.setData({ currentMonth });
    this.loadData();
  },

  onShow() {
    this.setData({ recordMode: app.globalData.recordMode });
    this.loadData();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadData() {
    if (this.data.loading) return;
    const openid = app.globalData.userInfo?._openid;
    if (!openid) return;

    this.setData({ loading: true });
    try {
      const [year, month] = this.data.currentMonth.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);

      const allMonthRecords = await recordApi.getRecords({
        openid,
        startDate: start,
        endDate: end,
        page: 1,
        pageSize: 1000
      });

      let income = 0, expense = 0;
      allMonthRecords.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        if (r.type === 'income') income += amt;
        else expense += amt;
      });

      const pageRecords = allMonthRecords.slice(0, this.data.pageSize);
      const processedRecords = this.processRecords(pageRecords);
      const grouped = this.groupByDate(processedRecords);

      this.setData({
        income: formatAmount(income),
        expense: formatAmount(expense),
        balance: formatAmount(income - expense),
        allMonthRecords,
        records: processedRecords,
        groupedRecords: grouped,
        hasMore: allMonthRecords.length > this.data.pageSize,
        loading: false
      });
    } catch (err) {
      console.error('加载数据失败', err);
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    const nextPage = this.data.page + 1;
    const startIdx = (nextPage - 1) * this.data.pageSize;
    const endIdx = startIdx + this.data.pageSize;
    const pageRecords = this.data.allMonthRecords.slice(startIdx, endIdx);

    if (pageRecords.length === 0) {
      this.setData({ hasMore: false });
      return;
    }

    this.setData({ page: nextPage, loading: true });

    try {
      const processedRecords = this.processRecords(pageRecords);
      const allRecords = [...this.data.records, ...processedRecords];

      this.setData({
        records: allRecords,
        groupedRecords: this.groupByDate(allRecords),
        hasMore: endIdx < this.data.allMonthRecords.length,
        loading: false
      });
    } catch (err) {
      console.error('加载更多失败', err);
      this.setData({ loading: false });
    }
  },

  processRecords(records) {
    return records.map(r => ({
      ...r,
      dateStr: formatDate(new Date(r.date)),
      amountStr: formatAmount(r.amount),
      displayCategory: r.subCategory && app.globalData.recordMode === 'detailed'
        ? `${r.category}-${r.subCategory}`
        : r.category
    }));
  },

  groupByDate(records) {
    const groups = {};
    records.forEach(r => {
      const date = r.dateStr;
      if (!groups[date]) {
        groups[date] = { date, day: date.split('-')[2], items: [], total: 0 };
      }
      groups[date].items.push(r);
      groups[date].total += r.type === 'expense' ? (parseFloat(r.amount) || 0) : 0;
    });
    return Object.values(groups).map(g => ({
      ...g,
      total: formatAmount(g.total)
    }));
  },

  onMonthChange(e) {
    this.setData({ currentMonth: e.detail.value, page: 1, hasMore: true });
    this.loadData();
  },

  goToRecord() {
    wx.navigateTo({ url: '/pages/record/record' });
  },

  goToEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/record/record?id=${id}` });
  },

  async deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#fa5151'
    });
    if (!res.confirm) return;

    try {
      await recordApi.deleteRecord(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ page: 1, hasMore: true });
      this.loadData();
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});
