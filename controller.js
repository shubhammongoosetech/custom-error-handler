
  // Qtech Casino
  async generateGameLobbyUrl(req: Request, res: Response) {
    const { userId } = req.params;
    if (userId) {
      try {
        const lobbyUrl = await userModel.generateGameLobbyUrl(userId);
        console.log("lobbyURL", lobbyUrl);
        return res.status(200).json({ url: lobbyUrl });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to generate game lobby URL' });
      }
    } else {
      return res.status(400).json({ message: 'UserId is required' });
    }
  }

  async verifySession(req: Request, res: Response, next: NextFunction) {
    try {
      const { playerId } = req.params;
      const { gameId } = req.query;
      const walletSession = req.headers['wallet-session'] as string;
      if (!playerId || !gameId || isNaN(parseInt(playerId))) {
        throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'Missing, invalid or expired player (wallet) session token.' });
        // return 
      }
      console.log('verify session', playerId, gameId, walletSession);

      if (!walletSession) {
        throw new BadRequestException({
          code: 'INVALID_TOKEN',
          message: 'Missing, invalid or expired player (wallet) session token.',
        });
      }

      const result = await userModel.verifySession(playerId, gameId as string, walletSession);

      // Success response
      return res.status(200).json(result);
    } catch (error) {
      console.log({ error });
      next(error);
    }
  }


  async getBalanceByQTech(req: Request, res: Response) {

    const { playerId } = req.params;
    const { gameId } = req.query;
    if (!playerId) {
      return res.status(400).json({
        code: 'REQUEST_DECLINED',
        message: 'General error. If request could not be processed.',
      });
    }
    console.log("verify balance", playerId);
    const result = await userModel.getBalanceByQTech(playerId);
    return res.status(200).json(result);

  }

  async casinoQTechTransactions(req: Request, res: Response, next: NextFunction) {

    try {

      const data: CasinoTransactionPayload = { ...req.body };
      console.log('transaction data', data);
      if (!data.playerId) {
        return res.status(403).json({ code: 'ACCOUNT_BLOCKED', message: 'The player account is blocked.' });
      }
      const walletSession = req.headers['wallet-session'] as string;

      console.log('walletSession', walletSession);
      if (!walletSession) {
        throw new BadRequestException({
          code: 'INVALID_TOKEN',
          message: 'Missing, invalid or expired player (wallet) session token.',
        });
      }
      if (isNaN(parseInt(data.playerId))) {
        throw new ForbiddenException({
          code: "ACCOUNT_BLOCKED",
          message: "The player account is blocked."
        });
      }

      const result = await userModel.transaction({
        txnType: data.txnType as string,
        txnId: data.txnId,
        playerId: data.playerId,
        roundId: data.roundId,
        amount: data.amount,
        currency: data.currency,
        gameId: data.gameId,
        created: data.created,
        completed: data.completed as boolean,
        walletSessionId: walletSession
      });

      return res.status(200).json(result);

    } catch (error) {
      console.log({ NextError: error });
      next(error);
    }

  }

  async qTechTtransactionsRollback(req: Request, res: Response, next: NextFunction) {

    try {

      const data: CasinoTransactionRollBackPayload = { ...req.body };

      console.log("data", data);
      if (!Number(data.playerId)) {
        throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'The player account is blocked.' });
      }
      const walletSession = req.headers['wallet-session'] as string;
      if (!walletSession) {
        throw new BadRequestException({ code: 'INVALID_TOKEN', message: 'Missing, invalid or expired player (wallet) session token.' });
      }


      const result = await userModel.rollback({
        txnId: data.txnId,
        betId: data.betId as string,
        playerId: data.playerId,
        roundId: data.roundId,
        amount: data.amount,
        currency: data.currency,
        gameId: data.gameId,
        created: data.created,
        walletSessionId: walletSession
      });

      return res.status(200).json(result);

    } catch (error) {

      console.log("error while placing bet", error);
      next(error);

    }

  }

  async bonusRewards(req: Request, res: Response, next: NextFunction) {

    try {
      const data: CasinoBonusReward = { ...req.body };

      if (!Number(data.playerId)) {
        throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'The player account is blocked.' });
      }
      if (!data.rewardType) {
        throw new BadRequestException({
          code: 'REQUEST_DECLINED',
          message: 'General error. If request could not be processed.'
        });
      }

      console.log("bonus data", data);
      const result = await userModel.bonusRewards({
        txnId: data.txnId,
        rewardType: data.rewardType,
        rewardTitle: data.rewardTitle,
        playerId: data.playerId,
        amount: data.amount,
        currency: data.currency,
        created: data.created
      });

      return res.status(200).json(result);
    } catch (error) {
      console.log("errrorrrr", error);
      next(error);
    }

  }

  async getRoundHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const query: unknown = req.query;

      if (query && typeof query === "object") {
        const args = { ...query } as casinoHistoryPayload;
        console.log('search', args);
        // console.log("search status",args.)
        const response = await userModel.getRoundHistory(
          args.uid || args._uid,
          args.search,
          args.limit || 10,
          args.offset || 0,
          args.startdate,
          args.enddate
        );
        return res.status(200).json({ response, message: "success" });
      } else {
        return res.status(400).end();
      }
    } catch (error) {
      console.error('Error fetching round history:', error);
      next(error);
    }
  }
}




export default UserController;
