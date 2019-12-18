import BN = require("bn.js");
import { IDAOState, IMemberState, IProposalState, Stake, Vote } from "@daostack/client";
import { getArc } from "arc";
import AccountPopup from "components/Account/AccountPopup";
import AccountProfileName from "components/Account/AccountProfileName";
import ProposalActionMenu from "components/Proposal/ProposalActionMenu";
import FollowButton from "components/Shared/FollowButton";
import Loading from "components/Shared/Loading";
import withSubscription, { ISubscriptionProps } from "components/Shared/withSubscription";
import { ethErrorHandler, humanProposalTitle } from "lib/util";
import * as moment from "moment";
import { connect } from "react-redux";
import { IRootState } from "reducers";
import { closingTime } from "reducers/arcReducer";
import { IProfileState } from "reducers/profilesReducer";
import * as React from "react";
import { Link } from "react-router-dom";
import { combineLatest } from "rxjs";

import * as css from "./Feed.scss";

const ReactMarkdown = require("react-markdown");


type SubscriptionData = [IDAOState, IProposalState, Stake[], Vote[], IMemberState, BN, BN];

interface IStateProps {
  beneficiaryProfile: IProfileState;
  currentAccountAddress: string;
  proposerProfile: IProfileState;
}

interface IExternalProps {
  currentAccountAddress: string;
  event: any;
}

type IProps = IStateProps & IExternalProps & ISubscriptionProps<SubscriptionData>;

const mapStateToProps = (state: IRootState, ownProps: IExternalProps & ISubscriptionProps<SubscriptionData>): IProps => {
  const proposalState = ownProps.data ? ownProps.data[1] : null;

  return {
    ...ownProps,
    beneficiaryProfile: proposalState && proposalState.contributionReward ? state.profiles[proposalState.contributionReward.beneficiary] : null,
    proposerProfile: state.profiles[ownProps.event.proposal.proposer],
  };
};

const ProposalFeedItem = (props: IProps) => {
  const { beneficiaryProfile, currentAccountAddress, data, event, proposerProfile } = props;
  const [ dao, proposal, stakes, votes, member, currentAccountGenBalance, currentAccountGenAllowance ] = data;

  const currentAccountVotes = votes.filter((v: Vote) => v.staticState.voter === currentAccountAddress);
  let currentAccountVote;
  if (currentAccountVotes.length > 0) {
    currentAccountVote = currentAccountVotes[0].staticState.outcome;
  }

  const expired = closingTime(proposal).isSameOrBefore(moment());

  return (
    <div data-test-id={`eventCardContent-${event.id}`} className={css.proposalItem}>
      <div className={css.daoName}>
        <Link to={`/dao/${dao.address}/scheme/${event.proposal.scheme.id}`}>{dao.name} &gt; {event.proposal.scheme.name} &gt;</Link>
      </div>

      <div className={css.proposalDetails}>
        <AccountPopup accountAddress={event.proposal.proposer} daoState={dao} width={17} />
        <AccountProfileName accountAddress={event.proposal.proposer} accountProfile={proposerProfile} daoAvatarAddress={dao.address} />
      </div>

      <Link to={`/dao/${dao.address}/proposal/${event.proposal.id}`}>
        <h3>Proposal {humanProposalTitle(event.proposal)}</h3>
      </Link>

      <div className={css.followButton}><FollowButton id={event.proposal.id} type="proposals" /></div>
      <div className={css.actionMenu}>
        <ProposalActionMenu
          beneficiaryProfile={beneficiaryProfile}
          buttonBorder
          proposal={proposal}
          currentAccountAddress={currentAccountAddress}
          currentAccountGenAllowance={currentAccountGenAllowance}
          currentAccountGenBalance={currentAccountGenBalance}
          currentAccountVote={currentAccountVote}
          daoState={dao}
          expired={expired}
          member={member}
          stakes={stakes}
        />
      </div>

      <div className={css.proposalDescription}>
        { event.proposal.description ?
          <ReactMarkdown source={event.proposal.description.slice(0, 600)}
            renderers={{link: (props: { href: string; children: React.ReactNode }) => {
              return <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>;
            }}}
          />
          : "" }
      </div>

      {event.proposal.description && event.proposal.description.length > 600 ?
        <Link to={`/dao/${dao.address}/proposal/${event.proposal.id}`}>Show full details &gt;</Link>
        : ""}

    </div>
  );
};

const ConnectedProposalFeedItem = connect(mapStateToProps)(ProposalFeedItem);

const SubscribedProposalFeedItem = withSubscription({
  wrappedComponent: ConnectedProposalFeedItem,
  loadingComponent: <div className={css.loading}><Loading/></div>,
  errorComponent: (props) => <div>{ props.error.message }</div>,

  checkForUpdate: ["event"],

  createObservable: (props: IExternalProps) => {
    const arc = getArc();
    const { currentAccountAddress, event } = props;
    const dao = arc.dao(event.dao.id);
    const proposal = arc.proposal(event.proposal);

    return combineLatest(
      dao.state(),
      proposal.state({ subscribe: true }),
      proposal.stakes({ where: { staker: currentAccountAddress }}, { subscribe: true }),
      proposal.votes({ where: { staker: currentAccountAddress }}, { subscribe: true }),
      dao.member(currentAccountAddress).state(),
      arc.GENToken().balanceOf(currentAccountAddress).pipe(ethErrorHandler()),
      arc.allowance(currentAccountAddress, proposal.staticState.votingMachine).pipe(ethErrorHandler())
    );
  },
});

export default SubscribedProposalFeedItem;
