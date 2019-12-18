import { Address, IDAOState, IMemberState, IProposalState, Stake } from "@daostack/client";

import BN = require("bn.js");
import classNames from "classnames";
import StakeButtons from "components/Proposal/Staking/StakeButtons";
import VoteButtons from "components/Proposal/Voting/VoteButtons";
import FollowButton from "components/Shared/FollowButton";
import * as React from "react";
import { IProfileState } from "reducers/profilesReducer";

import * as css from "./ProposalCard.scss";

interface IProps {
  beneficiaryProfile: IProfileState;
  buttonBorder?: boolean;
  currentAccountAddress: Address;
  currentAccountGenAllowance: BN;
  currentAccountGenBalance: BN;
  currentAccountVote: number;
  daoState: IDAOState;
  expired: boolean;
  member: IMemberState;
  proposal: IProposalState;
  stakes: Stake[];
}

export default class ProposalActionMenu extends React.Component<IProps, null> {

  public render(): RenderOutput {
    const {
      beneficiaryProfile,
      buttonBorder,
      currentAccountAddress,
      currentAccountGenAllowance,
      currentAccountGenBalance,
      currentAccountVote,
      daoState,
      expired,
      member,
      proposal,
      stakes,
    } = this.props;

    return (
      <div className={classNames({[css.contextMenu]: true, [css.buttonBorder]: buttonBorder})} data-test-id="proposalContextMenu">
        <div className={css.menuIcon}>
          <img src="/assets/images/Icon/Context-menu.svg"/>
        </div>
        <div className={css.menu}>
          <div className={css.followButton}>
            <FollowButton id={proposal.id} type="proposals" />
          </div>

          <VoteButtons
            currentAccountAddress={currentAccountAddress}
            currentAccountState={member}
            currentVote={currentAccountVote}
            dao={daoState}
            expired={expired}
            proposal={proposal}
            contextMenu
          />

          <StakeButtons
            beneficiaryProfile={beneficiaryProfile}
            contextMenu
            currentAccountAddress={currentAccountAddress}
            currentAccountGens={currentAccountGenBalance}
            currentAccountGenStakingAllowance={currentAccountGenAllowance}
            dao={daoState}
            expired={expired}
            proposal={proposal}
            stakes={stakes}
          />
        </div>
      </div>
    );
  }
}
