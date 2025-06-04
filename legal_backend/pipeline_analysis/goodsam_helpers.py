import sys
import os

parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
print(f"Parent directory: {parent_dir}")

sys.path.append(parent_dir)
#############################################################

#############################################################
############# IMPORTS #######################################
#############################################################

from legal_backend.r_to_py.r_to_py import init_R
from legal_backend.bartCause.bart_cause import BARTCause
from legal_backend.pip_utils import prepare_train_data, rmse, nrmse, r_square, coverage_rate, kfold_indices, prepare_permute_data, statistic
from legal_backend.pipeline_analysis.read_pattern import read_pattern

#############################################################
############# PACKAGES ######################################
#############################################################

import os
import pandas as pd

if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items

import numpy as np
from sklearn import preprocessing

from scipy.stats import permutation_test
from matplotlib import pyplot as plt
from scipy import stats
from collections import Counter


#############################################################
############# INITIALIZE ####################################
#############################################################

global df, df_pt, df_sub
global filterd_patterns_data, patterns_constraints, patterns_laws

base_dir = os.path.dirname(os.path.abspath(__file__))

def initialize_backend():
    global df
    init_R()

    data_path = os.path.join(base_dir, 'data', 'goodsam_all.csv')
    #load csv files and load possible laws
    df = pd.read_csv(data_path)
    df.rename(columns={'death-rate-2013-2016':'delta_death_rate'}, inplace=True)
    df['Urbanicity'] = df['Urbanicity'].map({'Urban':1, 'Rural':0})
    # df.columns
    print("Initialization complete.")



def get_initial_patterns():
    global filterd_patterns_data, patterns_constraints, patterns_laws
    global df_pt, df_sub

    data_path = os.path.join(base_dir, 'data', 'goodsam_all.csv')
    patterns_path = os.path.join(base_dir, 'data', 'patterns_for_opioid_death.csv')
    df_pt = pd.read_csv(patterns_path)
    df_sub = pd.read_csv(data_path)

    filterd_patterns_data = dict()
    patterns_constraints = dict()
    patterns_laws = dict()

    for i in range(df_pt.shape[0]):
    # for i in range(26,30):
        # print(i)
        _, df_idx, conds, law = read_pattern(df_pt.iloc[i]['description'], 'df_sub', df_sub)
        filterd_patterns_data[i] = df_idx
        patterns_constraints[i] = conds
        patterns_laws[i] = law


#############################################################
############# HELPER METHODS ################################
#############################################################        

def cross_validation_test(df, law, fold_indices):
    bartCause = BARTCause()
    
    X_df = df.iloc[:, :27].to_numpy()
    M = X_df.shape[1] 

    y = df[['delta_death_rate']].to_numpy()
    Z_law = df[[law]].to_numpy()
    # numerical columns
    num_cols = [c for c in range(M) if len(np.unique(X_df[:, c])) > 2] 

    scores = []

    for fold, (train_indices, test_indices) in enumerate(fold_indices):
        print("fold:",fold)
        X_train, y_train, Z_train = X_df[train_indices,:], y[train_indices,:], Z_law[train_indices,:]
        X_test, y_test, Z_test = X_df[test_indices,:], y[test_indices,:], Z_law[test_indices,:]

        # standardize data
        scaler_ = preprocessing.StandardScaler().fit(X_train[:,num_cols])
        X_train_scaled = np.copy(X_train)
        X_train_scaled[:,num_cols] = scaler_.transform(X_train[:,num_cols])

        X_test_scaled = np.copy(X_test)
        X_test_scaled[:,num_cols] = scaler_.transform(X_test[:,num_cols])
        
        # Train the model on the training data
        bartCause.fit(X_train_scaled, y_train, Z_train, n_samples=1000,  n_burn=200,  n_chains=5)

        # Make predictions on the test data
        test_data = np.concatenate((X_test_scaled, Z_test), axis=1)
        y_test_pred_, _, _ = bartCause.predict(test_data, infer_type="mu")
        y_test_pred = y_test_pred_[:,np.newaxis]
        
        # Calculate the accuracy score for this fold
        fold_score = nrmse(y_test, y_test_pred, 'range')
        
        # Append the fold score to the list of scores
        scores.append(fold_score)

    # Calculate the mean accuracy across all folds
    mean_score = np.mean(scores)

    return scores, mean_score


## RUN BART FOR EXISTING PATTERN - HELPER

def pattern_BART_helper(df_sub, law, conds):
    
    X_train_scaled, y_train, Z_train, X_test_scaled, y_test, Z_test = prepare_train_data(df_sub, law)

    bart_eval = BARTCause()
    bart_eval.fit(X_train_scaled, y_train, Z_train, n_samples=1000,  n_burn=200,  n_chains=5)

    # evaluate BART fit on response surface
    newData = np.concatenate((X_test_scaled, Z_test), axis=1)

    y_test_predicted_, y_test_predicted_lb, y_test_predicted_ub = bart_eval.predict(newData, infer_type="mu")

    y_test_predicted = y_test_predicted_[:,np.newaxis]
    y_test_predicted_lb = y_test_predicted_lb[:,np.newaxis]
    y_test_predicted_ub = y_test_predicted_ub[:,np.newaxis]

    print("quantile(0.05-0.95): [",np.quantile(y_test, 0.05),",", np.quantile(y_test, 0.95),"]")
    print("BART RMS:", rmse(y_test,y_test_predicted),"\n", "Baseline RMS:", rmse(y_test,y_test.mean()))
    print("r square:", r_square(y_test,y_test_predicted), "\n", "nrmse:", nrmse(y_test, y_test_predicted, 'range'))
    # print("coverage rate:", coverage_rate(y_test, y_test_predicted_lb, y_test_predicted_ub))

    fold_indices = kfold_indices(df_sub, 5)

    scores, mean_score = cross_validation_test(df_sub, law, fold_indices)
    #print("K-Fold Cross-Validation Scores:", scores)
    print("Mean Score:", mean_score)

    bartCause = BARTCause()
    X_scaled, y, Z_law = prepare_permute_data(df_sub, law)
    bartCause.fit(X_scaled, y, Z_law, n_samples=1000,  n_burn=200,  n_chains=5)

    # evaluate BART fit on response surface
    newData = np.concatenate((X_scaled, Z_law), axis=1)

    predicted_Z1, _, _ = bartCause.predict(newData, infer_type="mu.1")
    predicted_Z0, _, _ = bartCause.predict(newData, infer_type="mu.0")
    # predicted_Z1 = predicted_Z1_[:,np.newaxis]
    # predicted_Z0 = predicted_Z0_[:,np.newaxis]
    mean_law0 = predicted_Z0.mean()
    mean_law1 = predicted_Z1.mean()
    avg_ite = (predicted_Z1 - predicted_Z0).mean()
    std_ite = (predicted_Z1 - predicted_Z0).std()
    print("Avg ITE:", avg_ite,"Stdev ITE:",std_ite)

    alternative_str = 'less' if avg_ite > 0 else 'greater'

    # PERMUTATION TEST
    res_permute = permutation_test((predicted_Z0, predicted_Z1), statistic, alternative=alternative_str)

    #PAIRED SAMPLES T-TEST
    res_ttest = stats.ttest_rel(predicted_Z0, predicted_Z1, alternative=alternative_str)

    # MANN WHITNEY U TEST
    res_mannwhitneyu = stats.mannwhitneyu(predicted_Z0, predicted_Z1, alternative=alternative_str)



    histogram_data = [predicted_Z0, predicted_Z1, mean_law0, mean_law1]
    test_scores = [res_mannwhitneyu.pvalue, res_permute.pvalue, res_ttest.pvalue]
    ite_scores = [avg_ite, std_ite]

    cleaned_conds = []
    for cond in conds:
        cleaned_conds.append(cond[6:])
    
    return histogram_data, test_scores, ite_scores, cleaned_conds



## BART FOR EXISTING PATTERN - MAIN
def pattern_BART(patternNo):
    global df
    df_sub = df.copy(deep=True)
    conds = patterns_constraints[patternNo]
    law = patterns_laws[patternNo]

    if len(conds) != 0:
        for cond in conds:
            df_sub = df_sub.loc[eval(cond)].reset_index(drop=True)
    else:
        print("No filters in pattern")


    if law == "":
        law  = 'goodsam-cs_Prosecution'
        print("No law in pattern")

    print(law)

    return pattern_BART_helper(df_sub, law, conds)
        

if __name__ == "__main__":

    initialize_backend()
    get_initial_patterns()

    histogram_data, test_scores, ite_scores, cleaned_conds = pattern_BART(29)

    print("Mean Inactive Law: ", histogram_data[2])
    print("Mean Active Law: ", histogram_data[3])
    print("Mann Whitney p-value: ", test_scores[0])
    print("Permuation p-value: ", test_scores[1])
    print("Paired t p-value: ", test_scores[2])
    print("Avg ITE:", ite_scores[0],"\nStdev ITE:",ite_scores[1])
    print(cleaned_conds)