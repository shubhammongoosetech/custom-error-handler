
async generateGameLobbyUrl(userId: string) {

    const user = await User.findOne({ where: { id: Number(userId) } });

    if (!user) {
      throw new Error("User not found");
    }
    let accessTokenData: {
      id?: number;
      accessToken: string;
      expireAt: Date;
      isExpired: boolean;
    } | null;
    accessTokenData = await generateLobby.getAccessToken();
    console.log("accessTokenData", accessTokenData);

    if (!accessTokenData || accessTokenData === null) {
      const newToken = await generateLobby.createAccessToken();
      console.log("newRToken", newToken);
      // const newToken: any = "76236f90-dc9c-36d7-9e78-3e716d5ecf92";
      if ('error' in newToken) {
        throw new Error(newToken.message);
      }
      accessTokenData = newToken;
    }

    const walletSessionId = await generateLobby.generateWalletSessionId();
    console.log("walletSessionId", walletSessionId);
    await CasinoPlayerSession.create({
      playerId: Number(userId),
      walletSessionId,
      isExpired: false
    });


    try {

      const payload = {
        playerId: userId,
        displayName: user.username,
        currency: 'INR',
        country: 'IN',
        lang: "en_US",
        mode: 'real',
        device: 'desktop',
        walletSessionId,
        gameLaunchTarget: "SELF",
        search: true,
        config: {
          displays: {
            search: true
          },
        }
      };
      const url = `${process.env.QTECH_BASE_URL}/v1/games/lobby-url`;
      const token = accessTokenData?.accessToken;

      const config = {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      };

      console.log("token", url, payload, config);

      const res = await axios.post(url, payload, config);
      console.log('resresresres', res);
      return res.data;

    } catch (error) {
      console.log("error", error);
      return {
        error: 'Internal error',
        message: 'Internal server error'
      };
    }
  }


  async verifySession(playerId: string, gameId: string, walletSession: string) {
    const user = await User.findByPk(playerId);
    if (!user || !user.balance) {
      throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'The player account is blocked.' });
    }

    const playerSession = await CasinoPlayerSession.findOne({ where: { playerId, isExpired: false, walletSessionId: walletSession } });

    if (!playerSession) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Missing, invalid or expired player (wallet) session token.'
      });
    }

    const balance = parseFloat(Number(user.balance).toFixed(2));

    return {
      balance,
      currency: 'INR',
    };

  }

  async getBalanceByQTech(playerId: string) {
    const user = await User.findByPk(Number(playerId));
    if (!user || !user.balance) {
      return new ForbiddenException({ code: 'REQUEST_DECLINED', message: 'General error. If request could not be processed.' });
    }

    console.log("user balance", user.balance);
    const balance = parseFloat(Number(user.balance).toFixed(2));

    return {
      balance, // Fiat currency balance with 2 decimal places
      currency: 'INR', // Currency code (ISO 4217)
    };
  }


  async transaction(data: {
    txnType: string; txnId: string;
    playerId: string; roundId: string; amount: number;
    currency: string; gameId: string; created: string;
    completed: boolean; walletSessionId: string;
  }) {

    // if (!data.playerId || !data.txnType || !data.amount || !data.currency || !data.gameId || !data.roundId) {
    //   throw new BadRequestException({
    //     code: 'INVALID_INPUT',
    //     message: 'Missing required fields or invalid data.',
    //   });
    // }

    // if (!data.playerId) {
    //   throw new BadRequestException({
    //     code: "REQUEST_DECLINED",
    //     message: "General error. If request could not be processed.",
    //   });
    // }

    const user = await User.findByPk(Number(data.playerId));
    if (!user || !user.balance) {
      throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'The player account is blocked.' });
    }
    console.log("userbyPK", user);

    const t = await sequelize.transaction();

    // create casino transaction
    const qTechCasinoTransaction = await QTechCasinoTransaction.create({
      walletSessionId: data.walletSessionId,
      transactionType: data.txnType === 'DEBIT' ? 'DEBIT' : 'CREDIT',
      transactionId: data.txnId,
      playerId: Number(data.playerId),
      amount: data.amount,
      currency: data.currency,
      gameId: data.gameId,
      roundId: data.roundId,
      created: data.created,
      completed: data.completed,
    },
      { transaction: t }
    );

    console.log("qTechCasinoTransaction", qTechCasinoTransaction);

    // Upsert round history
    const roundHistory = await CasinoRoundHistory.findOrCreate({
      where: {
        // roundId: data.roundId,
        // playerId: Number(data.playerId),
        gameId: data.gameId
      },
      defaults: {
        roundId: data.roundId,
        txnId: data.txnId,
        playerId: Number(data?.playerId),
        totalWins: 0,
        totalBets: 0,
        completed: false,
        gameId: data.gameId,
        status: "pending",
      },
      returning: true,
      transaction: t,
    });




    const createdRoundHistory = roundHistory[0];
    console.log("qTechCasinoTransaction.transactionId", qTechCasinoTransaction.transactionId);
    console.log("data", data.txnType === "DEBIT", qTechCasinoTransaction.transactionId != data.txnId);

    if (data.txnType === "DEBIT") {
      console.log("first case");
      if (data.amount >= Number(1000)) {
        throw new BadRequestException({
          code: "INSUFFICIENT_FUNDS",
          message: "If the requested DEBIT amount is higher than the player's balance within the Operator system.",
        });
      }

      const playerSession = await CasinoPlayerSession.findOne({
        where: {
          playerId: Number(data.playerId),
          isExpired: false,
          walletSessionId: data.walletSessionId,
        },
        transaction: t,
      });

      if (!playerSession) {
        throw new BadRequestException({
          code: "INVALID_TOKEN",
          message: "Missing, invalid, or expired player (wallet) session token.",
        });
      }

      console.log("totalBets", createdRoundHistory.totalBets);
      console.log("roundID for update", data.roundId, Number(createdRoundHistory.totalBets) + Number(data.amount));
      const [affectedRows, updatedCasinoRound] = await CasinoRoundHistory.update(
        {
          totalBets: Number(createdRoundHistory.totalBets) + Number(data.amount),
          completed: data.completed,
          status: data.completed ? "loss" : "pending",
        },
        {
          where: { roundId: data.roundId }, returning: true,
          transaction: t,
        }
      );
      const newBalance: number = Number(user.balance) - Number(data.amount);
      console.log("newBalance", newBalance, data.txnId);

      const checkTransactionId = await QTechCasinoTransaction.findOne({
        where: {
          transactionId: data.txnId
        }
      });

      console.log('now code is here', newBalance, checkTransactionId);

      // substract user balance
      let updatedBalance: any;
      if (!checkTransactionId) {
        const [_affectedRows, updatedUser] = await User.update({
          balance: (newBalance)
        },
          {
            where: { id: Number(data.playerId) },
            transaction: t,
            returning: true
          }
        );

        updatedBalance = Number(updatedUser[0]?.balance);
      }
      // substract user balance

      console.log('condition check');

      // create the Qtechtransaction
      const tx = await QTechWalletTransaction.create(
        {
          context: "TicketPurchase",
          type: "DEBIT",
          amount: data.amount,
          availableBalance: user.balance,
          entityId: data.txnId,
          status: "Confirmed",
        },
        { transaction: t }
      );

      await t.commit();

      // const maxDecimalPlaces = data.currency === "fiat" ? 2 : 8;
      // const balance = parseFloat(updatedBalance.toFixed(maxDecimalPlaces));
      const balance = parseFloat(Number(checkTransactionId ? user.balance : updatedBalance).toFixed(2));
      return {
        balance: balance,
        referenceId: String(checkTransactionId ? checkTransactionId?.id : qTechCasinoTransaction?.id),
      };

    }
    else if (data.txnType === "CREDIT" && data.amount > 0) {

      console.log("Number(createdRoundHistory.totalWins) + Number(data.amount)");
      console.log(Number(createdRoundHistory.totalWins) + Number(data.amount));
      console.log(Number(createdRoundHistory.totalWins), Number(data.amount));
      const [affectedRows, updatedRows] = await CasinoRoundHistory.update(
        {
          totalWins: Number(createdRoundHistory.totalWins) + Number(data.amount),
          status: "win",
          completed: data.completed,
        },
        { where: { roundId: data.roundId }, transaction: t, returning: true }
      );

      const updatedCasinoRound = updatedRows[0];

      const checkTransactionId = await QTechCasinoTransaction.findOne({
        where: {
          transactionId: data.txnId
        }
      });

      // add balance to user account
      const _newBalance: number = Number(user.balance) + Number(data.amount);
      console.log("newBalance", _newBalance);
      let updatedBalance: any;
      if (!checkTransactionId) {
        const [_affectedRows, updatedUser] = await User.update({
          balance: Number(_newBalance)
        },
          {
            where: { id: Number(data.playerId) },
            transaction: t,
            returning: true
          }
        );

        updatedBalance = Number(updatedUser[0]?.balance);
      }

      // add balance to user account

      const tx = await QTechWalletTransaction.create({
        context: 'Won',
        type: 'CREDIT',
        amount: data.amount,
        entityId: data.txnId,
        status: 'Confirmed',
      }, { transaction: t });

      await t.commit();

      // const balance = parseFloat(Number(updatedUser[0].balance).toFixed(2));
      // return {
      //   balance: balance,
      //   referenceId: String(qTechCasinoTransaction.id)
      // };

      const balance = parseFloat(Number(checkTransactionId ? user.balance : updatedBalance).toFixed(2));
      return {
        balance: balance,
        referenceId: String(checkTransactionId ? checkTransactionId?.id : qTechCasinoTransaction?.id),
      };
    }
    else if (data.completed) {
      console.log("third case");
      const hasCredit = await QTechCasinoTransaction.findOne({
        where: { roundId: data.roundId, transactionType: 'CREDIT' }
      });

      console.log("hasCredit", hasCredit);
      let _updatedCasinoRound: number = 0;
      if (!hasCredit) {
        const [affectedRows, updatedCasinoRound] = await CasinoRoundHistory.update(
          {
            status: 'loss',
            completed: data?.completed,
          },
          { where: { roundId: data.roundId }, returning: true, transaction: t }
        );

        // hasCredit
        _updatedCasinoRound = updatedCasinoRound[0]?.id;
        console.log("_updatedCasinoRound", _updatedCasinoRound);
      }

      const wallet = await User.findByPk(data.playerId);
      const balance = parseFloat(Number(wallet?.balance).toFixed(2));
      return {
        balance: balance,
        referenceId: String(qTechCasinoTransaction.id)
      };

    }


  }

  async rollback(data: {
    txnId: string;
    betId: string;
    playerId: string;
    roundId: string;
    amount: number;
    currency: string;
    gameId: string;
    created: string;
    walletSessionId: string;
  }) {

    try {

      const t = await sequelize.transaction();

      let user = await User.findByPk(Number(data?.playerId));

      const originalTransaction = await QTechCasinoTransaction.findOne(
        {
          where: { transactionId: data.betId, playerId: Number(data.playerId), roundId: data.roundId },
          transaction: t
        }
      );

      if (!originalTransaction) {
        console.warn(`No original transaction found for txnId: ${data.betId}`);
        return { balance: parseFloat(Number(user?.balance).toFixed(2)), referenceId: null };
      }

      console.log("data check", data.betId);
      const checkTransaction = await QTechCasinoTransaction.findOne(
        {
          where: { transactionId: data.txnId, transactionType: 'ROLLBACK' },
          transaction: t
        }
      );

      console.log("originalTransactionoriginalTransaction", checkTransaction);

      if (checkTransaction) {
        const balance = parseFloat(Number(user?.balance).toFixed(2));
        return {
          balance: balance,
          referenceId: String(checkTransaction?.id),
        };
      }

      // create roll back for QTech transaction
      const rollbackTransaction = await QTechCasinoTransaction.create({
        walletSessionId: data.walletSessionId,
        transactionType: "ROLLBACK",
        transactionId: data.txnId,
        playerId: Number(data.playerId),
        roundId: data.roundId,
        amount: data.amount,
        currency: data.currency,
        gameId: data.gameId,
        created: data.created,
        completed: true
      },
        { transaction: t }
      );

      const roundHistory = await CasinoRoundHistory.findOne({ where: { roundId: data.roundId }, transaction: t });
      console.log("roundhistory", roundHistory);
      if (roundHistory) {
        const [affectedRows, updatedCasinoRound] = await CasinoRoundHistory.update(
          {
            totalBets: Number(roundHistory.totalBets) - Number(data.amount),
            status: "rollback",
          },
          { where: { roundId: data.roundId }, transaction: t, returning: true },
        );

        console.log("updatedCasinoRound", updatedCasinoRound[0].totalBets);
      }


      console.log("Number(user?.balance) + Number(data.amount)", Number(user?.balance) + Number(data.amount));

      const checkTransactionId = await QTechCasinoTransaction.findOne({
        where: {
          transactionId: data.txnId
        }
      });

      let updatedBalance: any;
      const [_affectedRows, updatedUser] = await User.update({
        balance: Number(user?.balance) + Number(data.amount)
      },
        {
          where: { id: Number(data.playerId) },
          transaction: t,
          returning: true
        }
      );

      updatedBalance = Number(updatedUser[0]?.balance);


      await t.commit();

      // const user = await User.findByPk(Number(data.playerId));
      const balance = parseFloat(Number(updatedBalance).toFixed(2));
      return {
        balance: balance,
        referenceId: String(rollbackTransaction?.id),
      };

    } catch (error) {

      console.log("error while rollback", error);
      throw new BadRequestException({ code: "UNKNOWN_ERROR", message: "Unexpected error" });

    }

  }


  async bonusRewards(data: {
    txnId: string;
    rewardType: string;
    rewardTitle: string;
    amount: number;
    currency: string;
    playerId: string;
    created: string;
  }) {

    console.log("data", data);

    const user = await User.findByPk(Number(data.playerId));
    const casinoTransaction = await QTechCasinoTransaction.findOne({
      where: { transactionId: data.txnId }
    });
    console.log("casinoTransaction", casinoTransaction);
    const _casinoTransaction = await CasinoRewards.findOne({ where: { transactionId: data.txnId } });
    if (casinoTransaction) {
      if (_casinoTransaction) {
        const balance = parseFloat(Number(user?.balance).toFixed(2));
        return {
          balance: balance,
          referenceId: casinoTransaction.id
        };
      }

    }

    try {

      console.log("dfnndvfbfdlblcdmn");

      const t = await sequelize.transaction();

      const casinoReawrds = await CasinoRewards.create({
        rewardType: data.rewardType,
        rewardTitle: data.rewardTitle,
        playerId: data.playerId,
        amount: data.amount,
        currency: data.currency,
        created: data.created,
        transactionId: data.txnId,
      },
        { transaction: t }
      );
      console.log("casinoRewards", casinoReawrds);

      console.log(Number(user?.balance) + Number(data.amount));
      console.log(Number(user?.balance), Number(data.amount));

      const checkTransactionId = await CasinoRewards.findOne({
        where: {
          transactionId: data.txnId
        }
      });

      let updatedBalance: any;
      if (!checkTransactionId) {
        const [_affectedRows, updatedUser] = await User.update({
          balance: Number(user?.balance) + Number(data.amount)
        },
          {
            where: { id: Number(data.playerId) },
            transaction: t,
            returning: true
          }
        );

        updatedBalance = Number(updatedUser[0]?.balance);
      }


      console.log("updatedUser", updatedBalance);
      await t.commit();

      const balance = parseFloat(Number(checkTransactionId ? user?.balance : updatedBalance).toFixed(2));
      return {
        balance: balance,
        referenceId: String(checkTransactionId ? checkTransactionId?.id : casinoReawrds.id),
      };
    } catch (error) {
      console.log("error while getting rewards", error);
      throw new BadRequestException({ code: "UNKNOWN_ERROR", message: "Unexpected error" });

    }

  }



  async getRoundHistory(
    id: number,
    search?: 'pending' | 'win' | 'loss' | 'rollback',
    limit?: number,
    offset?: number,
    startDate?: string,
    endDate?: string
  ) {
    const where = {
      player_id: id,
      status: search,
      createdAt: {
        [Op.lt]: endDate || new Date(),
        [Op.gt]: startDate || new Date('1970-01-01'),
      },
    };

    // Remove undefined values from the where clause
    Object.keys(where).forEach((key) => {
      if (where[key as keyof typeof where] === undefined) {
        delete (where as Record<string, any>)[key];
      }
    });


    const count = await CasinoRoundHistory.count({ where });
    const history = await CasinoRoundHistory.findAll({
      where,
      offset: offset || 0,
      limit: limit || 10,
      order: [['createdAt', 'DESC']],
    });
    console.log("history data", history);

    return {
      count,
      skip: offset || 0,
      take: limit || 10,
      data: history,
    };
  }
}


export default UserModel;

