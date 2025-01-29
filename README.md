

# if we have try and catch in the service file so must use this 
         console.log("error while getting rewards", error);
      throw new BadRequestException({ code: "UNKNOWN_ERROR", message: "Unexpected error" });

# and if we on the controller so we need to pass the code to the custom handler 
      console.error('Error fetching round history:', error);
      next(error);
