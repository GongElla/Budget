const db = wx.cloud.database();
const _ = db.command;

const COLLECTIONS = {
  USERS: 'users',
  FAMILIES: 'families',
  RECORDS: 'records',
  CATEGORIES: 'categories',
  SUB_CATEGORIES: 'subCategories'
};

function buildWhere(base, extra) {
  const conditions = [];
  for (const key in base) {
    if (base[key] !== undefined && base[key] !== null && base[key] !== '') {
      conditions.push({ [key]: base[key] });
    }
  }
  for (const key in extra) {
    if (extra[key] !== undefined && extra[key] !== null) {
      conditions.push({ [key]: extra[key] });
    }
  }
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return _.and(...conditions);
}

const userApi = {
  async getUser(openid) {
    const res = await db.collection(COLLECTIONS.USERS).where({ _openid: openid }).limit(1).get();
    return res.data[0];
  },

  async updateUser(openid, data) {
    const res = await db.collection(COLLECTIONS.USERS).where({ _openid: openid }).limit(1).get();
    if (res.data.length === 0) return;
    return db.collection(COLLECTIONS.USERS).doc(res.data[0]._id).update({ data });
  },

  async createUser(userInfo) {
    return db.collection(COLLECTIONS.USERS).add({ data: userInfo });
  }
};

const recordApi = {
  async getRecords(options = {}) {
    const { openid, familyId, type, category, startDate, endDate, page = 1, pageSize = 20 } = options;

    const where = buildWhere(
      { openid, familyId, type, category },
      startDate && endDate
        ? { date: _.gte(new Date(startDate)).and(_.lte(new Date(endDate))) }
        : {}
    );

    const res = await db.collection(COLLECTIONS.RECORDS)
      .where(where)
      .orderBy('date', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return res.data;
  },

  async addRecord(data) {
    return db.collection(COLLECTIONS.RECORDS).add({
      data: {
        ...data,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
  },

  async updateRecord(id, data) {
    return db.collection(COLLECTIONS.RECORDS).doc(id).update({
      data: { ...data, updateTime: db.serverDate() }
    });
  },

  async deleteRecord(id) {
    return db.collection(COLLECTIONS.RECORDS).doc(id).remove();
  }
};

const categoryApi = {
  async getCategories(openid, type) {
    const res = await db.collection(COLLECTIONS.CATEGORIES)
      .where({ _openid: openid, type })
      .orderBy('sortOrder', 'asc')
      .get();
    return res.data;
  },

  async addCategory(data) {
    const { openid, _openid, ...cleanData } = data;
    return db.collection(COLLECTIONS.CATEGORIES).add({ data: cleanData });
  },

  async updateCategory(id, data) {
    return db.collection(COLLECTIONS.CATEGORIES).doc(id).update({ data });
  },

  async deleteCategory(id) {
    return db.collection(COLLECTIONS.CATEGORIES).doc(id).remove();
  },

  async getSubCategories(openid, parentCategory) {
    const res = await db.collection(COLLECTIONS.SUB_CATEGORIES)
      .where({ _openid: openid, parentCategory })
      .orderBy('sortOrder', 'asc')
      .get();
    return res.data;
  },

  async addSubCategory(data) {
    const { openid, _openid, ...cleanData } = data;
    return db.collection(COLLECTIONS.SUB_CATEGORIES).add({ data: cleanData });
  },

  async updateSubCategory(id, data) {
    return db.collection(COLLECTIONS.SUB_CATEGORIES).doc(id).update({ data });
  },

  async deleteSubCategory(id) {
    return db.collection(COLLECTIONS.SUB_CATEGORIES).doc(id).remove();
  },

  async deleteSubCategoriesByParent(openid, parentCategory) {
    const res = await db.collection(COLLECTIONS.SUB_CATEGORIES)
      .where({ _openid: openid, parentCategory })
      .get();
    return Promise.all(res.data.map(item =>
      db.collection(COLLECTIONS.SUB_CATEGORIES).doc(item._id).remove()
    ));
  }
};

const familyApi = {
  async getFamily(familyId) {
    const res = await db.collection(COLLECTIONS.FAMILIES).doc(familyId).get();
    return res.data;
  },

  async createFamily(data) {
    return db.collection(COLLECTIONS.FAMILIES).add({ data });
  },

  async updateFamily(familyId, data) {
    return db.collection(COLLECTIONS.FAMILIES).doc(familyId).update({ data });
  },

  async deleteFamily(familyId) {
    return db.collection(COLLECTIONS.FAMILIES).doc(familyId).remove();
  },

  async getFamilyByInviteCode(inviteCode) {
    const res = await db.collection(COLLECTIONS.FAMILIES).where({ inviteCode }).get();
    return res.data[0] || null;
  }
};

module.exports = {
  db,
  _,
  COLLECTIONS,
  userApi,
  recordApi,
  categoryApi,
  familyApi
};
