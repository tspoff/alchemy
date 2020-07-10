import { Address, DAO, IDAOState, IProposalStage, AnyProposal, Plugin, Stake, Vote, Proposals } from "@daostack/arc.js";
import { getArc } from "arc";
import Loading from "components/Shared/Loading";
import withSubscription, { ISubscriptionProps } from "components/Shared/withSubscription";
import gql from "graphql-tag";
import Analytics from "lib/analytics";
import { Page } from "pages";
import * as React from "react";
import { BreadcrumbsItem } from "react-breadcrumbs-dynamic";
import InfiniteScroll from "react-infinite-scroll-component";
import { Link, RouteComponentProps } from "react-router-dom";
import * as Sticky from "react-stickynode";
import { combineLatest, from } from "rxjs";
import { first } from "rxjs/operators";
import ProposalHistoryRow from "../Proposal/ProposalHistoryRow";
import * as css from "./Dao.scss";

const PAGE_SIZE = 50;

interface IExternalProps extends RouteComponentProps<any> {
  currentAccountAddress: Address;
  daoState: IDAOState;
}

type SubscriptionData = [AnyProposal[], IDAOState];
type IProps = IExternalProps & ISubscriptionProps<SubscriptionData>;

class DaoHistoryPage extends React.Component<IProps, null> {

  public componentDidMount() {
    const [, daoState] = this.props.data;

    Analytics.track("Page View", {
      "Page Name": Page.DAOHistory,
      "DAO Address": daoState.address,
      "DAO Name": daoState.name,
    });
  }

  public render(): RenderOutput {
    const { data, hasMoreToLoad, fetchMore, currentAccountAddress } = this.props;

    const [proposals, daoState] = data;

    const proposalsHTML = proposals.map((proposal: AnyProposal) => {
      return (<ProposalHistoryRow key={"proposal_" + proposal.id} history={this.props.history} proposal={proposal} daoState={daoState} currentAccountAddress={currentAccountAddress} />);
    });

    return (
      <div>
        <BreadcrumbsItem to={"/dao/" + daoState.address + "/history"}>History</BreadcrumbsItem>

        <Sticky enabled top={50} innerZ={10000}>
          <div className={css.daoHistoryHeader}>
            History
          </div>
        </Sticky>

        <InfiniteScroll
          dataLength={proposals.length} //This is important field to render the next data
          next={fetchMore}
          hasMore={hasMoreToLoad}
          loader=""
          style={{overflow: "visible"}}
          endMessage={null}
        >
          { proposals.length === 0 ?
            <span>This DAO hasn&apos;t passed any proposals yet. Checkout the <Link to={"/dao/" + daoState.id + "/proposal/"}>DAO&apos;s installed pluginss</Link> for any open proposals.</span> :
            <table className={css.proposalHistoryTable}>
              <thead>
                <tr className={css.proposalHistoryTableHeader}>
                  <th>Proposed by</th>
                  <th>End date</th>
                  <th>Plugin</th>
                  <th>Title</th>
                  <th>Votes</th>
                  <th>Predictions</th>
                  <th>Status</th>
                  <th>My actions</th>
                </tr>
              </thead>
              <tbody>
                {proposalsHTML}
              </tbody>
            </table>
          }
        </InfiniteScroll>

      </div>
    );
  }
}

export default withSubscription({
  wrappedComponent: DaoHistoryPage,
  loadingComponent: <Loading />,
  errorComponent: (props) => <div>{props.error.message}</div>,

  checkForUpdate: [],

  createObservable: async (props: IExternalProps) => {
    const arc = getArc();
    const dao = new DAO(arc, props.daoState);

    // this query will fetch al data we need before rendering the page, so we avoid hitting the server
    // with all separate queries for votes and stakes and stuff...
    let voterClause = "";
    let stakerClause = "";
    if (props.currentAccountAddress) {
      voterClause = `(where: { voter: "${props.currentAccountAddress}"})`;
      stakerClause = `(where: { staker: "${props.currentAccountAddress}"})`;
    }

    // NOTE: We cannot use the fragment to reduce the boilerplate here because
    // we're using nested where filters for voters & stakers. These fields are already
    // present in the fragment. See here for a solution: https://github.com/daostack/arc.js/issues/471
    const prefetchQuery = gql`
      query prefetchProposalDataForDAOHistory {
        proposals (
          first: ${PAGE_SIZE}
          skip: 0
          orderBy: "closingAt"
          orderDirection: "desc"
          where: {
            dao: "${dao.id}"
            stage_in: [
              "${IProposalStage[IProposalStage.ExpiredInQueue]}",
              "${IProposalStage[IProposalStage.Executed]}",
              "${IProposalStage[IProposalStage.Queued]}"
            ]
            closingAt_lte: "${Math.floor(new Date().getTime() / 1000)}"
          }
        ){
          id
          accountsWithUnclaimedRewards
          boostedAt
          closingAt
          confidenceThreshold
          createdAt
          dao {
            id
            schemes {
              id
              address
            }
          }
          description
          descriptionHash
          executedAt
          executionState
          expiresInQueueAt
          genesisProtocolParams {
            id
            activationTime
            boostedVotePeriodLimit
            daoBountyConst
            limitExponentValue
            minimumDaoBounty
            preBoostedVotePeriodLimit
            proposingRepReward
            queuedVotePeriodLimit
            queuedVoteRequiredPercentage
            quietEndingPeriod
            thresholdConst
            votersReputationLossRatio
          }
          gpRewards {
            id
          }
          scheme {
            ...PluginFields
          }
          gpQueue {
            id
            threshold
            votingMachine
          }
          organizationId
          preBoostedAt
          proposer
          quietEndingPeriodBeganAt
          stage
          stakesFor
          stakesAgainst
          tags {
            id
          }
          totalRepWhenCreated
          totalRepWhenExecuted
          title
          url
          votesAgainst
          votesFor
          votingMachine
          winningOutcome
          votes ${voterClause} {
            ...VoteFields
          }
          stakes ${stakerClause} {
            ...StakeFields
          }
          ${Object.values(Proposals)
    .filter((proposal) => proposal.fragment)
    .map((proposal) => "..." + proposal.fragment?.name)
    .join("\n")}
        }
      }
      ${Object.values(Proposals)
    .filter((proposal) => proposal.fragment)
    .map((proposal) => proposal.fragment?.fragment.loc?.source.body)
    .join("\n")}
      ${Vote.fragments.VoteFields}
      ${Stake.fragments.StakeFields}
      ${Plugin.baseFragment}
    `;
    await arc.getObservable(prefetchQuery, { subscribe: true }).pipe(first()).toPromise();
    return combineLatest(
      dao.proposals({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          stage_in: [IProposalStage.ExpiredInQueue, IProposalStage.Executed, IProposalStage.Queued],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          closingAt_lte: Math.floor(new Date().getTime() / 1000),
        },
        orderBy: "closingAt",
        orderDirection: "desc",
        first: PAGE_SIZE,
        skip: 0,
      },
      // get and subscribe to all data, so that subcomponents do nto have to send separate queries
      { fetchAllData: true }),
      from(dao.fetchState())
    );
  },

  // used for hacky pagination tracking
  pageSize: PAGE_SIZE,

  getFetchMoreObservable: (props: IExternalProps, data: SubscriptionData) => {
    const dao = new DAO(getArc(), props.daoState);
    return dao.proposals({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        stage_in: [IProposalStage.ExpiredInQueue, IProposalStage.Executed, IProposalStage.Queued],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        closingAt_lte: Math.floor(new Date().getTime() / 1000),
      },
      orderBy: "closingAt",
      orderDirection: "desc",
      first: PAGE_SIZE,
      skip: data.length,
    }, { fetchAllData: true } // get and subscribe to all data, so that subcomponents do nto have to send separate queries
    );
  },
});
