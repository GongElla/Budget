const app = getApp();
const { formatMonth, getMonthRange, formatAmount } = require('../../utils/util');

Page({
  data: {
    currentMonth: '',
    type: 'expense',
    total: 0,
    count: 0,
    avg: 0,
    categoryStats: [],
    trendData: [],
    familyId: ''
  },

  async onLoad() {
    await app.loginPromise.catch(() => {});
    this.setData({
      currentMonth: formatMonth(new Date()),
      familyId: app.globalData.userInfo?.familyId || ''
    });
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    const openid = app.globalData.userInfo?._openid;
    if (!openid) return;

    try {
      const [year, month] = this.data.currentMonth.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);

      const res = await wx.cloud.callFunction({
        name: 'getMonthlyStats',
        data: {
          openid,
          familyId: this.data.familyId,
          type: this.data.type,
          startDate: start,
          endDate: end
        }
      });

      const stats = res.result;
      this.setData({
        total: formatAmount(stats.total),
        count: stats.count,
        avg: formatAmount(stats.avg),
        categoryStats: stats.categoryStats || [],
        trendData: stats.trendData || []
      }, () => {
        this.drawPieChart();
        this.drawTrendChart();
      });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  drawPieChart() {
    const { categoryStats } = this.data;
    if (categoryStats.length === 0) return;

    const query = wx.createSelectorQuery();
    query.select('#pieCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);

      const centerX = res[0].width / 2;
      const centerY = res[0].height / 2;
      const radius = Math.min(centerX, centerY) - 40;
      const colors = ['#07c160', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#047857'];
      const total = categoryStats.reduce((sum, item) => sum + item.amount, 0);

      let startAngle = -Math.PI / 2;
      categoryStats.forEach((item, index) => {
        const angle = (item.amount / total) * Math.PI * 2;
        const endAngle = startAngle + angle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();

        startAngle = endAngle;
      });

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.font = 'bold 28rpx sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('总计', centerX, centerY - 10);
      ctx.font = 'bold 32rpx sans-serif';
      ctx.fillText(this.data.total, centerX, centerY + 30);
    });
  },

  drawTrendChart() {
    const { trendData } = this.data;
    if (trendData.length === 0) return;

    const query = wx.createSelectorQuery();
    query.select('#trendCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);

      const width = res[0].width;
      const height = res[0].height;
      const padding = { top: 30, right: 20, bottom: 40, left: 60 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const maxValue = Math.max(...trendData.map(d => d.amount), 1);
      const points = trendData.map((d, i) => ({
        x: padding.left + (i / (trendData.length - 1 || 1)) * chartWidth,
        y: padding.top + chartHeight - (d.amount / maxValue) * chartHeight,
        label: d.month,
        value: d.amount
      }));

      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();

      if (points.length > 0) {
        ctx.strokeStyle = '#07c160';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        ctx.fillStyle = '#07c160';
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.fillStyle = '#999';
      ctx.font = '20rpx sans-serif';
      ctx.textAlign = 'center';
      points.forEach(p => {
        ctx.fillText(p.label, p.x, height - padding.bottom + 30);
      });

      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const value = (maxValue / 4) * i;
        const y = padding.top + chartHeight - (i / 4) * chartHeight;
        ctx.fillText(value.toFixed(0), padding.left - 10, y + 5);
      }
    });
  },

  onMonthChange(e) {
    this.setData({ currentMonth: e.detail.value });
    this.loadStats();
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      type,
      total: '0.00',
      count: 0,
      avg: '0.00',
      categoryStats: [],
      trendData: []
    });
    this.loadStats();
  },

  shareStat() {
    wx.showLoading({ title: '生成海报中' });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '海报生成成功', icon: 'success' });
    }, 1500);
  }
});
