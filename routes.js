router.post("/lobby/:userId", user.generateGameLobbyUrl);
router.get("/accounts/:playerId/session", user.verifySession);
router.get("/accounts/:playerId/balance", user.getBalanceByQTech);
router.post("/transactions", user.casinoQTechTransactions);
router.post("/transactions/rollback", user.qTechTtransactionsRollback);
router.post("/bonus/rewards", user.bonusRewards);

router.get("get-all-round-history", user.getRoundHistory);
