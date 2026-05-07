const app = getApp();
const { familyApi, userApi } = require('../../utils/db');
const { formatAmount, formatMonth, getMonthRange, generateInviteCode } = require('../../utils/util');

Page({
  data: {
    family: null,
    members: [],
    isCreator: false,
    showJoinModal: false,
    inviteCode: '',
    familyStats: null,
    currentMonth: ''
  },

  async onLoad() {
    await app.loginPromise.catch(() => {});
    this.setData({ currentMonth: formatMonth(new Date()) });
    this.loadFamilyInfo();
  },

  onShow() {
    this.loadFamilyInfo();
  },

  async loadFamilyInfo() {
    const openid = app.globalData.userInfo?._openid;
    if (!openid) return;

    try {
      const user = app.globalData.userInfo;
      if (!user.familyId) {
        this.setData({ family: null, members: [] });
        return;
      }

      const family = await familyApi.getFamily(user.familyId);
      if (!family) {
        this.setData({ family: null });
        return;
      }

      const db = wx.cloud.database();
      const memberRes = await db.collection('users').where({
        _openid: db.command.in(family.members)
      }).get();

      const members = memberRes.data.map(m => ({
        ...m,
        isCreator: m._openid === family.creatorOpenid
      }));

      this.setData({
        family,
        members,
        isCreator: openid === family.creatorOpenid
      });

      this.loadFamilyStats(family._id);
    } catch (err) {
      console.error('加载家庭信息失败', err);
    }
  },

  async loadFamilyStats(familyId) {
    try {
      const [year, month] = this.data.currentMonth.split('-').map(Number);
      const { start, end } = getMonthRange(year, month);

      const res = await wx.cloud.callFunction({
        name: 'getFamilyStats',
        data: { familyId, startDate: start, endDate: end }
      });

      this.setData({ familyStats: res.result });
    } catch (err) {
      console.error('加载家庭统计失败', err);
    }
  },

  async createFamily() {
    const res = await wx.showModal({
      title: '创建家庭组',
      editable: true,
      placeholderText: '请输入家庭名称'
    });

    if (!res.confirm || !res.content) return;

    try {
      const openid = app.globalData.userInfo._openid;
      const result = await familyApi.createFamily({
        name: res.content,
        creatorOpenid: openid,
        members: [openid],
        inviteCode: generateInviteCode(),
        createTime: new Date()
      });

      await userApi.updateUser(openid, {
        familyId: result._id,
        role: 'creator'
      });

      app.globalData.userInfo.familyId = result._id;
      app.globalData.userInfo.role = 'creator';

      wx.showToast({ title: '创建成功', icon: 'success' });
      this.loadFamilyInfo();
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  showJoinModal() {
    this.setData({ showJoinModal: true, inviteCode: '' });
  },

  hideJoinModal() {
    this.setData({ showJoinModal: false });
  },

  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  async joinFamily() {
    const { inviteCode } = this.data;
    if (!inviteCode || inviteCode.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' });
      return;
    }

    try {
      const family = await familyApi.getFamilyByInviteCode(inviteCode);
      if (!family) {
        wx.showToast({ title: '邀请码无效', icon: 'none' });
        return;
      }

      const openid = app.globalData.userInfo._openid;
      if (family.members.includes(openid)) {
        wx.showToast({ title: '你已在该家庭组中', icon: 'none' });
        return;
      }

      await familyApi.updateFamily(family._id, {
        members: [...family.members, openid]
      });

      await userApi.updateUser(openid, {
        familyId: family._id,
        role: 'member'
      });

      app.globalData.userInfo.familyId = family._id;
      app.globalData.userInfo.role = 'member';

      wx.showToast({ title: '加入成功', icon: 'success' });
      this.setData({ showJoinModal: false });
      this.loadFamilyInfo();
    } catch (err) {
      wx.showToast({ title: '加入失败', icon: 'none' });
    }
  },

  async leaveFamily() {
    const res = await wx.showModal({
      title: '确认退出',
      content: '退出家庭组后，你的个人记账数据将保留，但不再参与家庭统计',
      confirmColor: '#fa5151'
    });
    if (!res.confirm) return;

    try {
      const openid = app.globalData.userInfo._openid;
      if (this.data.isCreator) {
        wx.showToast({ title: '创建者不能退出，请先转让或解散', icon: 'none' });
        return;
      }

      const family = this.data.family;
      await familyApi.updateFamily(family._id, {
        members: family.members.filter(m => m !== openid)
      });

      await userApi.updateUser(openid, { familyId: '', role: 'none' });

      app.globalData.userInfo.familyId = '';
      app.globalData.userInfo.role = 'none';

      wx.showToast({ title: '已退出', icon: 'success' });
      this.setData({ family: null, members: [] });
    } catch (err) {
      wx.showToast({ title: '退出失败', icon: 'none' });
    }
  },

  async dissolveFamily() {
    const res = await wx.showModal({
      title: '确认解散',
      content: '解散后家庭统计数据将清空，成员的个人数据保留。此操作不可恢复！',
      confirmColor: '#fa5151'
    });
    if (!res.confirm) return;

    try {
      const family = this.data.family;

      for (const memberId of family.members) {
        await userApi.updateUser(memberId, { familyId: '', role: 'none' });
      }

      await familyApi.deleteFamily(family._id);

      app.globalData.userInfo.familyId = '';
      app.globalData.userInfo.role = 'none';

      wx.showToast({ title: '已解散', icon: 'success' });
      this.setData({ family: null, members: [] });
    } catch (err) {
      wx.showToast({ title: '解散失败', icon: 'none' });
    }
  },

  async removeMember(e) {
    const memberId = e.currentTarget.dataset.id;
    if (memberId === app.globalData.userInfo._openid) {
      wx.showToast({ title: '不能移除自己', icon: 'none' });
      return;
    }

    const res = await wx.showModal({
      title: '确认移除',
      content: '确定要移除该成员吗？',
      confirmColor: '#fa5151'
    });
    if (!res.confirm) return;

    try {
      const family = this.data.family;
      await familyApi.updateFamily(family._id, {
        members: family.members.filter(m => m !== memberId)
      });

      await userApi.updateUser(memberId, { familyId: '', role: 'none' });

      wx.showToast({ title: '已移除', icon: 'success' });
      this.loadFamilyInfo();
    } catch (err) {
      wx.showToast({ title: '移除失败', icon: 'none' });
    }
  },

  copyInviteCode() {
    const code = this.data.family?.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    });
  }
});
