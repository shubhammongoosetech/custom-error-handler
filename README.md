

# if we have try and catch in the service file so must use this 
         console.log("error while getting rewards", error);
      throw new BadRequestException({ code: "UNKNOWN_ERROR", message: "Unexpected error" });

# and if we on the controller so we need to pass the code to the custom handler 
      console.error('Error fetching round history:', error);
      next(error);


# there are some point to establish glober error
1.  **use middleware after the router app.use(GlobalErrorHandlerMiddleware)**:
2. **so first write service use try catch and inside catch throw error so this error back to the controller**:
3. **inside controller use next middlewares to pass this error to the midlewares error function return the error to the client**:
1. **this middleware error function match error with error collection file and match according that error message send to the client**:
