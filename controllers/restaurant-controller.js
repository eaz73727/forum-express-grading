const { Restaurant, Category, User, Comment, sequelize } = require('../models')
const { getOffset, getPagination } = require('../helpers/pagination-helper')
const restaurantController = {
  getRestaurants: (req, res, next) => {
    const DEFAULT_LIMIT = 9
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || DEFAULT_LIMIT
    const offset = getOffset(limit, page)
    const categoryId = Number(req.query.categoryId) || ''

    return Promise.all([
      Restaurant.findAndCountAll({
        include: Category,
        where: {
          ...categoryId ? { categoryId } : {}
        },
        limit,
        offset,
        nest: true,
        raw: true
      }),
      Category.findAll({ raw: true })
    ])
      .then(([restaurants, categories]) => {
        const favoritedRestaurantsId = req.user && req.user.FavoritedRestaurants.map(fr => fr.id)
        const likedRestaurantsId = req.user && req.user.LikedRestaurants.map(fr => fr.id)
        const data = restaurants.rows.map(r => ({
          ...r,
          description: r.description.substring(0, 50),
          isFavorited: favoritedRestaurantsId.includes(r.id),
          isLiked: likedRestaurantsId.includes(r.id)
        }))
        return res.render('restaurants', {
          restaurants: data,
          categories,
          categoryId,
          pagination: getPagination(limit, page, restaurants.count)
        })
      })
      .catch(err => next(err))
  },
  getRestaurant: async (req, res, next) => {
    try {
      const restaurant = await Restaurant.findByPk(req.params.id, {
        include: [Category,
          { model: Comment, include: User },
          { model: User, as: 'FavoritedUsers' },
          { model: User, as: 'LikedUsers' }
        ],
        nest: true
      })
      await restaurant.increment('view_counts')
      const isFavorited = restaurant.FavoritedUsers.some(f => f.id === req.user.id)
      const isLiked = restaurant.LikedUsers.some(f => f.id === req.user.id)
      return res.render('restaurant', { restaurant: restaurant.toJSON(), isFavorited, isLiked })
    } catch (err) {
      next(err)
    }
  },
  getDashboard: async (req, res, next) => {
    try {
      const restaurant = await Restaurant.findByPk(req.params.id, {
        include: Category,
        nest: true,
        raw: true
      })
      return res.render('dashboard', { restaurant })
    } catch (err) {
      next(err)
    }
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [Category],
        raw: true,
        nest: true
      }),
      Comment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [User, Restaurant],
        raw: true,
        nest: true
      })
    ])
      .then(([restaurants, comments]) => {
        res.render('feeds', {
          restaurants,
          comments
        })
      })
      .catch(err => next(err))
  },
  getTopRestaurants: (req, res, next) => {
    return Restaurant.findAll({
      attributes: {
        include: [[sequelize.literal('(SELECT COUNT(*) FROM Favorites WHERE Favorites.restaurant_id = Restaurant.id)'), 'favoritedCount']]
      },
      order: [[sequelize.literal('favoritedCount'), 'DESC']],
      limit: 10,
      raw: true
    })
      .then(restaurants => {
        const favoritedRestaurantsId = req.user && req.user.FavoritedRestaurants.map(restaurant => restaurant.id)
        restaurants.map(restaurant => (
          restaurant.isFavorited = favoritedRestaurantsId.includes(restaurant.id)
        ))
        return res.render('top-restaurants', { restaurants })
      })
      .catch(err => next(err))
  }
}

module.exports = restaurantController
