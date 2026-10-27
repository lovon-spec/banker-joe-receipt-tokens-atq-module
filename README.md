# Banker Joe lending receipt token tags

ATQ module for Banker Joe receipt token markets on Avalanche (43114), from the Messari-published Banker Joe subgraph 9NjYuG2BFU1BPacNdKymd9eNdfVCaJM6LhsgD8zSQgDK. The pinned deployment is its current version. Every market is paged by unique contract address at a single indexed block hash; its outputToken must be that same market contract. Underlying tokens are not emitted. Banker Joe is the historical lending product of Trader Joe, now LFJ.

Build with Yarn and call the sole exported async returnTags(chainId, apiKey). All implementation is in src/main.mts. Errors and inconsistent metadata fail the whole call.

Project Name uses the full rebranded name and abbreviation from the project's announcement: https://joecontent.substack.com/p/lets-fing-joe-formerly-trader-joe

Unpublished preparation draft; no registry review or filing authority.
