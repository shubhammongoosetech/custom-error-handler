// Handle undefined routes
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = "ROUTE_NOT_FOUND";
  next(error);
});

RequestHandler(app);

// Global error handler (must come after all routes and middlewares)
app.use(GlobalErrorHandlerMiddleware);

/**
 * always use this middlewares for the custom error handling
 * so use this always on the after routes
 */
