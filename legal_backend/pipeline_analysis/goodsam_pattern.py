import sys
import datetime
import os
import ast
import pandas as pd
import math
import copy
if not hasattr(pd.DataFrame, "iteritems"):
    pd.DataFrame.iteritems = pd.DataFrame.items
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS  # If your frontend is on a different domain
from sklearn import preprocessing
from scipy.stats import mannwhitneyu, permutation_test, stats
from collections import Counter
from werkzeug.utils import secure_filename
import os
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Add base directory to path
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.abspath(os.path.join(base_dir, '..', '..')))


import contextlib
from rpy2.robjects.packages import importr
import rpy2.robjects as robjects
from rpy2.robjects import numpy2ri

# Import your custom modules
from legal_backend.r_to_py.r_to_py import init_R
from legal_backend.bartCause.bart_cause import BARTCause
from legal_backend.pip_utils import (
    prepare_train_data, rmse, nrmse, r_square,
    coverage_rate, kfold_indices, prepare_permute_data, statistic
)
from legal_backend.pipeline_analysis.read_pattern import read_pattern



# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS

# Initialize global variables
global df, df_pt, df_sub, df_constraints, df_geomap, df_fips_county,constraints_dict, patterns_constraints_dict
global filterd_patterns_data_rows, patterns_constraints, patterns_laws, patterns_fips, column_bounds



##### GLOBAL VARIABLES #####
# df_pt :
# patterns_constraints_dict : bounds (min,max) for each constraint in each pattern for all patterns
# constraints_dict : bounds (lb,ub) for each constraint in each pattern for all patterns
# patterns_constraints : constraints in each pattern for all patterns in "df_sub[]" format


#############################



####### DATA PATHS #######
# Use environment variables for paths or fallback to default paths
DATA_DIR = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
data_path = os.path.join(DATA_DIR, 'goodsam_all.csv')
patterns_path = os.path.join(DATA_DIR, 'patterns_for_opioid_death.csv')
geomap_path = os.path.join(DATA_DIR, '2013-2016_Good_Samaritan_Overdose_Prevention_Laws.csv')
fips_county_path = os.path.join(DATA_DIR, 'fips_county_state.csv')
#########################

# Initialize R context properly for each request
# @app.before_request
# def init_rpy2():
#     # Activate numpy conversion
#     numpy2ri.activate()
    
#     # Import required R packages
#     try:
#         # Only import if not already imported
#         if not hasattr(robjects, '_bartcause_initialized'):
#             # Import commonly used R packages
#             robjects.r('library(bartCause)')
#             robjects.r('library(rpart)')
#             robjects.r('library(randomForest)')
#             robjects._bartcause_initialized = True
            
#         # Print R session info for debugging
#         print("R session initialized for request")
#     except Exception as e:
#         print(f"Error initializing R: {e}")

# def get_memory_usage():
#     """Get current memory usage in MB."""
#     import os
#     import psutil
#     process = psutil.Process(os.getpid())
#     memory_info = process.memory_info()
#     memory_mb = memory_info.rss / 1024 / 1024
#     return memory_mb

# def log_memory_usage(label=""):
#     """Log current memory usage with an optional label."""
#     memory_mb = get_memory_usage()
#     logger.info(f"Memory usage {label}: {memory_mb:.2f} MB")

# @app.before_request
# def log_request_memory():
#     """Log memory usage before processing request."""
#     log_memory_usage("before request")

# @app.after_request
# def log_response_memory(response):
#     """Log memory usage after processing request."""
#     log_memory_usage("after response")
#     return response

def initialize_backend(main_file=None, pattern_file=None):
    """
    Initialize the backend with data from specified files or default files.
    
    Args:
        main_file (str, optional): Name of the main CSV file to use. If None, uses default.
        pattern_file (str, optional): Name of the pattern CSV file to use. If None, uses default.
    """
    global df, df_constraints, constraints_dict, patterns_constraints_dict, column_bounds
    init_R()

    # Use environment variable for data directory or fallback to default
    DATA_DIR = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
    
    # Use specified files or defaults
    main_file_path = os.path.join(DATA_DIR, main_file if main_file else 'goodsam_all.csv')
    pattern_file_path = os.path.join(DATA_DIR, pattern_file if pattern_file else 'patterns_for_opioid_death.csv')

    # Load main data CSV
    df = pd.read_csv(main_file_path)
    if 'death-rate-2013-2016' in df.columns:
        df.rename(columns={'death-rate-2013-2016': 'delta_death_rate'}, inplace=True)
    if 'Urbanicity' in df.columns:
        df['Urbanicity'] = df['Urbanicity'].map({'Urban': 1, 'Rural': 0})

    # Get column bounds
    column_bounds = {}
    for column in df.columns:
        # For other columns
        column_bounds[column] = {
            'min': math.floor(float(df[column].min())*10000)/10000,
            'max': math.ceil(float(df[column].max())*10000)/10000
        }

    # Load constraints for all patterns - CSV data
    df_constraints = pd.read_csv(pattern_file_path)

    # Preprocess constraints into a dictionary
    constraints_dict = {}
    patterns_constraints_dict = {}
    for index, row in df_constraints.iterrows():
        desc_str = row['description']
        try:
            # Replace 'inf' and '-inf' with large numerical values for initial parsing
            desc_str = desc_str.replace('inf', '1e100').replace('-inf', '-1e100')
            
            desc_dict = ast.literal_eval(desc_str)
            id_val = desc_dict.get('ID')  # ID  = Pattern NO. - 1
            constraints = desc_dict.get('constraints', {})

            # Process each constraint with real bounds
            for column, bounds in constraints.items():
                if column in column_bounds:
                    # # Replace upper bound
                    if bounds.get('ub', 0) >= 1e100:
                        bounds['ub'] = math.ceil(column_bounds[column]['max'] * 10000) / 10000
                    bounds['ub'] = math.ceil(bounds['ub'] * 10000) / 10000
                    
                    # Replace lower bound
                    if bounds.get('lb', 0) <= -1e100:
                        bounds['lb'] = math.floor(column_bounds[column]['min'] * 10000) / 10000
                    bounds['lb'] = math.floor(bounds['lb'] * 10000) / 10000

            constraints_dict[id_val] = copy.deepcopy(constraints)
            
            # Process each constraint with real bounds
            for column, bounds in constraints.items():
                if column in column_bounds:
                    # # Replace upper bound
                    # if bounds.get('ub', 0) >= 1e100:
                    bounds['ub'] = math.ceil(column_bounds[column]['max'] * 10000) / 10000
                    
                    # Replace lower bound
                    # if bounds.get('lb', 0) <= -1e100:
                    bounds['lb'] = math.floor(column_bounds[column]['min'] * 10000) / 10000
            
            patterns_constraints_dict[id_val] = copy.deepcopy(constraints)
            
        except Exception as e:
            print(f"Error parsing constraints in row {index}: {e}")
            pass

def get_initial_patterns(geomap_file=None, fips_county_file=None):
    """
    Initialize pattern-related globals using the specified files or defaults.
    
    Args:
        geomap_file (str, optional): Name of the geomap CSV file to use. If None, uses default.
        fips_county_file (str, optional): Name of the FIPS county mapping file to use. If None, uses default.
    """
    global filterd_patterns_data_rows, patterns_constraints, patterns_laws, patterns_fips
    global df_pt, df_sub, df_geomap, df_fips_county

    # Use environment variable for data directory or fallback to default
    DATA_DIR = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
    
    # Use specified files or defaults
    geomap_path = os.path.join(DATA_DIR, geomap_file if geomap_file else '2013-2016_Good_Samaritan_Overdose_Prevention_Laws.csv')
    fips_county_path = os.path.join(DATA_DIR, fips_county_file if fips_county_file else 'fips_county_state.csv')

    df_geomap = pd.read_csv(geomap_path)
    df_pt = df_constraints  # Use the global df_constraints
    df_sub = df  # Use the global df
    df_fips_county = pd.read_csv(fips_county_path)

    filterd_patterns_data_rows = dict()
    patterns_constraints = dict()
    patterns_laws = dict()
    patterns_fips = dict()

    for i in range(df_pt.shape[0]):
        _, df_idx, conds, law = read_pattern(df_pt.iloc[i]['description'], 'df_sub', df_sub)
        filterd_patterns_data_rows[i] = df_idx
        patterns_constraints[i] = conds
        patterns_laws[i] = law
        patterns_fips[i] = df_geomap.iloc[df_idx]['FIPS'].tolist()

def cross_validation_test(df, law, fold_indices):
    bartCause = BARTCause()

    X_df = df.iloc[:, :27].to_numpy()
    M = X_df.shape[1] 

    y = df[['delta_death_rate']].to_numpy()
    Z_law = df[[law]].to_numpy()
    # Numerical columns
    num_cols = [c for c in range(M) if len(np.unique(X_df[:, c])) > 2] 

    scores = []

    for fold, (train_indices, test_indices) in enumerate(fold_indices):
        print("fold:", fold)
        X_train, y_train, Z_train = X_df[train_indices, :], y[train_indices, :], Z_law[train_indices, :]
        X_test, y_test, Z_test = X_df[test_indices, :], y[test_indices, :], Z_law[test_indices, :]

        # Standardize data
        scaler_ = preprocessing.StandardScaler().fit(X_train[:, num_cols])
        X_train_scaled = np.copy(X_train)
        X_train_scaled[:, num_cols] = scaler_.transform(X_train[:, num_cols])

        X_test_scaled = np.copy(X_test)
        X_test_scaled[:, num_cols] = scaler_.transform(X_test[:, num_cols])
        
        # Train the model on the training data
        bartCause.fit(X_train_scaled, y_train, Z_train, n_samples=1000, n_burn=200, n_chains=5)

        # Make predictions on the test data
        test_data = np.concatenate((X_test_scaled, Z_test), axis=1)
        y_test_pred_, _, _ = bartCause.predict(test_data, infer_type="mu")
        y_test_pred = y_test_pred_[:, np.newaxis]
        
        # Calculate the accuracy score for this fold
        fold_score = nrmse(y_test, y_test_pred, 'range')
        
        # Append the fold score to the list of scores
        scores.append(fold_score)

    # Calculate the mean accuracy across all folds
    mean_score = np.mean(scores)

    return scores, mean_score

def intervention_overlap(n_active, n_inactive):
    # Imbalance Ratio - Before model training
    if n_inactive==0 or n_active==0:
        return 0
    
    overall_imbalance =  (n_active/n_inactive) if n_active>n_inactive else (n_inactive/n_active)
    # print("Imbalanced Data Detected! Imbalnce Ratio:", overall_imbalance) if (overall_imbalance > 10) else print("Imbalnce Ratio:",overall_imbalance)
    return overall_imbalance

def cohens_d(predicted_Z1, predicted_Z0):
    """Compute Cohen's d for treatment (Z=1) vs control (Z=0)."""
    mean_treat, mean_ctrl = np.mean(predicted_Z1), np.mean(predicted_Z0)
    std_treat, std_ctrl = np.std(predicted_Z1, ddof=1), np.std(predicted_Z0, ddof=1)

    # Compute pooled standard deviation
    n_treat, n_ctrl = len(predicted_Z1), len(predicted_Z0)
    s_pooled = np.sqrt(((n_treat - 1) * std_treat**2 + (n_ctrl - 1) * std_ctrl**2) / (n_treat + n_ctrl - 2))

    # Cohen's d
    d = (mean_treat - mean_ctrl) / s_pooled
    return d

def create_histogram_with_consistent_bins(df_full, df_filtered, feature_names):
    """
    Create histograms for both the full dataset and filtered subset using the same bins.
    
    Args:
        df_full: The full dataframe
        df_filtered: The filtered dataframe (subset)
        feature_names: List of feature names to create histograms for
    
    Returns:
        Tuple of (full_column_histograms, filtered_column_histograms)
    """
    full_column_histograms = {}
    filtered_column_histograms = {}
    
    for feature in feature_names:
        # Skip non-numeric columns
        if not pd.api.types.is_numeric_dtype(df_full[feature]):
            continue
            
        # Get numeric data for the column from the full dataset
        full_feature_data = df_full[feature].dropna()
        
        # Check if we have filtered data for this feature
        if feature in df_filtered.columns:
            filtered_feature_data = df_filtered[feature].dropna()
            
            # Only process if we have data in both sets
            if len(full_feature_data) > 0 and len(filtered_feature_data) > 0:
                # Create histogram bins based on the full dataset
                # Determine the min and max values from the full dataset
                min_val = full_feature_data.min()
                max_val = full_feature_data.max()
                
                # Create 10 evenly spaced bins across the full dataset range
                bin_edges = np.linspace(min_val, max_val, 11)  # 11 edges for 10 bins
                
                # Calculate histograms using the same bin edges
                full_hist, _ = np.histogram(full_feature_data, bins=bin_edges)
                filtered_hist, _ = np.histogram(filtered_feature_data, bins=bin_edges)
                
                # Store histograms with the same bin edges
                full_column_histograms[feature] = {
                    "counts": full_hist.tolist(),
                    "bin_edges": bin_edges.tolist()
                }
                
                filtered_column_histograms[feature] = {
                    "counts": filtered_hist.tolist(),
                    "bin_edges": bin_edges.tolist()
                }
    
    return full_column_histograms, filtered_column_histograms

def pattern_BART_helper(df_sub, analysis_column, conds, n_active, n_inactive, threshold=None, inverse=False):

    # 1.Imbalance Ratio - before model training
    imbalance_ratio = intervention_overlap(n_active, n_inactive)
    
    # 2.TRAINING BART
    X_train_scaled, y_train, Z_train, X_test_scaled, y_test, Z_test = prepare_train_data(df_sub, analysis_column)

    bart_eval = BARTCause()
    bart_eval.fit(X_train_scaled, y_train, Z_train, n_samples=1000, n_burn=200, n_chains=5)

    # Evaluate BART fit on response surface
    newData = np.concatenate((X_test_scaled, Z_test), axis=1)

    y_test_predicted_, y_test_predicted_lb, y_test_predicted_ub = bart_eval.predict(newData, infer_type="mu")

    y_test_predicted = y_test_predicted_[:, np.newaxis]
    y_test_predicted_lb = y_test_predicted_lb[:, np.newaxis]
    y_test_predicted_ub = y_test_predicted_ub[:, np.newaxis]

    print("quantile(0.05-0.95): [", np.quantile(y_test, 0.05), ",", np.quantile(y_test, 0.95), "]")
    print("BART RMS:", rmse(y_test, y_test_predicted), "\n", "Baseline RMS:", rmse(y_test, y_test.mean()))
    print("r square:", r_square(y_test, y_test_predicted), "\n", "nrmse:", nrmse(y_test, y_test_predicted, 'range'))

    bartCause = BARTCause()
    X_scaled, y, Z_column = prepare_permute_data(df_sub, analysis_column)
    bartCause.fit(X_scaled, y, Z_column, n_samples=1000, n_burn=200, n_chains=5)

    # Get feature importance
    features = list(df_sub.columns[:27])  # Adjust the number based on your features
    importance = bart_eval.get_feature_importance()

    # Sort features by importance
    feature_importance = list(zip(features, importance))
    feature_importance.sort(key=lambda x: x[1], reverse=True)

    # Keep only top 10 features for visualization
    top_features = feature_importance[:10]
    top_feature_names = [f[0] for f in top_features]
    top_importance_values = [f[1] for f in top_features]

    # Evaluate BART fit on response surface
    newData = np.concatenate((X_scaled, Z_column), axis=1)

    predicted_Z1, _, _ = bartCause.predict(newData, infer_type="mu.1")
    predicted_Z0, _, _ = bartCause.predict(newData, infer_type="mu.0")
    
    mean_val0 = predicted_Z0.mean()
    mean_val1 = predicted_Z1.mean()
    avg_ite = (predicted_Z1 - predicted_Z0).mean()
    std_ite = (predicted_Z1 - predicted_Z0).std()
    print("Avg ITE:", avg_ite, "Stdev ITE:", std_ite)

    alternative_str = 'less' if avg_ite > 0 else 'greater'

    # PERMUTATION TEST
    res_permute = permutation_test((predicted_Z0, predicted_Z1), statistic, alternative=alternative_str)

    # PAIRED SAMPLES T-TEST
    res_ttest = stats.ttest_rel(predicted_Z0, predicted_Z1, alternative=alternative_str)

    # MANN WHITNEY U TEST
    res_mannwhitneyu = mannwhitneyu(predicted_Z0, predicted_Z1, alternative=alternative_str)

    # Cohen's d Effect Size Test
    cohensd = cohens_d(predicted_Z1, predicted_Z0)

    # Grouping Results 
    histogram_data = [predicted_Z0.tolist(), predicted_Z1.tolist(), mean_val0, mean_val1]
    test_scores = [res_mannwhitneyu.pvalue, res_permute.pvalue, res_ttest.pvalue, imbalance_ratio, cohensd]
    ite_scores = [avg_ite, std_ite]

    cleaned_conds = []
    for cond in conds:
        cleaned_conds.append(cond[6:])

    global df 
    full_column_histograms, filtered_column_histograms = create_histogram_with_consistent_bins(
        df, df_sub, top_feature_names
    )
  
    column_info = {
        "column_name": analysis_column,
        "threshold": threshold,
        "inverse": inverse
    }
    
    return {
        "histogram_data": histogram_data,
        "test_scores": test_scores,
        "ite_scores": ite_scores,
        "cleaned_conds": cleaned_conds,
        "feature_importance": {
            "features": top_feature_names,
            "importance": top_importance_values
        },
        "column_info": column_info,
        "column_histograms": filtered_column_histograms,
        "full_column_histograms": full_column_histograms
    }

def pattern_BART(patternNo=29):
    global df
    df_sub = df.copy(deep=True)
    conds = patterns_constraints.get(patternNo, [])
    logger.info("Conds:")
    logger.info(conds)
    law = patterns_laws.get(patternNo, "")

    if len(conds) != 0:
        for cond in conds:
            try:
                df_sub = df_sub.loc[eval(cond)].reset_index(drop=True)
            except Exception as e:
                logger.info(f"Error evaluating condition '{cond}': {e}")
                return {"error": f"Invalid condition: {cond}"}, 400
    else:
        logger.info("No filters in pattern")

    if not law:
        law = 'goodsam-cs_Prosecution'
        logger.info("No law in pattern")

    # logger.info(conds)

    try:
        result = pattern_BART_helper(df_sub, law, conds,1,1)
        return result
    except Exception as e:
        print(f"Error in pattern_BART_helper: {e}")
        return {"error": str(e)}, 500

def format_conditions(constraints):
    conds = []
    for column, bounds in constraints.items():
        if 'lb' in bounds and bounds['lb'] is not None:
            conds.append(f"df_sub['{column}']>={bounds['lb']}")
        if 'ub' in bounds and bounds['ub'] is not None:
            conds.append(f"df_sub['{column}']<={bounds['ub']}")
    return conds

def get_dataframe(constraints):
    global df_geomap, df, df_fips_county
    df_sub = df.copy(deep=True)
    
    if 'FIPS' not in df_sub.columns:
        fips_col = df_geomap['FIPS']
        df_sub.insert(0,"FIPS",fips_col)
        
    conds = format_conditions(constraints)

    if len(conds) != 0:
        for cond in conds:
            try:
                df_sub = df_sub.loc[eval(cond)].reset_index(drop=True)
            except Exception as e:
                logger.info(f"Error evaluating condition '{cond}': {e}")
                return {"error": f"Invalid condition: {cond}"}, 400
    else:
        logger.info("No filters in pattern")

    if df_sub.empty:
        logger.info("Filtered data is empty.")
        return {"error": "No data available for the selected constraints."}, 400
    return df_sub, conds

def constraints_BART(constraints, analysis_column, active_range=None, inactive_range=None):
    df_sub, conds = get_dataframe(constraints)
    
    if not analysis_column:
        analysis_column = 'goodsam-cs_Prosecution'
        logger.info("No analysis column provided, using default")
    
    # Create a temporary column for the ranges
    temp_column_name = f"{analysis_column}_binary_temp"

    numeric_values = df_sub[analysis_column]
    
    # Work with a numeric copy of the column if needed
    if not pd.api.types.is_numeric_dtype(df_sub[analysis_column]):
        numeric_values = pd.to_numeric(df_sub[analysis_column], errors='coerce')
    
    # Default initialization with all values as NaN (will be dropped)
    df_sub[temp_column_name] = np.nan
    
    # Apply active range (marked as 1)
    if active_range and len(active_range) == 2:
        min_val, max_val = active_range
        active_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
        df_sub.loc[active_mask, temp_column_name] = 1.0
    
    # Apply inactive range (marked as 0)
    if inactive_range and len(inactive_range) == 2:
        min_val, max_val = inactive_range
        inactive_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
        df_sub.loc[inactive_mask, temp_column_name] = 0.0
    
    # Drop rows that don't fall in either range
    df_sub = df_sub.dropna(subset=[temp_column_name]).reset_index(drop=True)
    
    # Use the temporary column for analysis
    analysis_column = temp_column_name
    
    # Create a mask for counties where value is 1
    active_mask = df_sub[analysis_column] == 1
    
    # Get FIPS codes for counties with active value
    active_fips = df_sub.loc[active_mask, 'FIPS'].tolist()
    
    # Get FIPS codes for counties with inactive value
    inactive_fips = df_sub.loc[~active_mask, 'FIPS'].tolist()

    # No. of active & inactive counties
    n_active = len(active_fips)
    n_inactive = len(inactive_fips)
    
    # Get all FIPS codes
    fips = df_sub['FIPS'].tolist()
    
    # Get county and state names
    comb_data = df_fips_county[df_fips_county["fips"].isin(fips)][["county_name", "state_name", "fips"]]
    
    # Get county and state names lists
    counties = comb_data["county_name"].tolist()
    states = comb_data["state_name"].tolist()
    
    # Remove FIPS column before BART analysis
    df_sub_no_fips = df_sub.iloc[:, 1:]

    try:
        result = pattern_BART_helper(df_sub_no_fips, analysis_column, conds, n_active, n_inactive)
        
        # Clean up the temporary column if created
        if temp_column_name in df_sub.columns:
            df_sub.drop(columns=[temp_column_name], inplace=True)
        if temp_column_name in df_sub_no_fips.columns:
            df_sub_no_fips = df_sub_no_fips.drop(columns=[temp_column_name])
            
        return result, fips, counties, states, active_fips, inactive_fips
    except Exception as e:
        print(f"Error in pattern_BART_helper: {e}")
        # Clean up the temporary column if created
        if temp_column_name in df_sub.columns:
            df_sub.drop(columns=[temp_column_name], inplace=True)
        if temp_column_name in df_sub_no_fips.columns:
            df_sub_no_fips = df_sub_no_fips.drop(columns=[temp_column_name])

        return {"error": str(e)}, 500
    
def cross_validation_helper(constraints, analysis_column, active_range=None, inactive_range=None):
    df_sub, _ = get_dataframe(constraints)
    
    if not analysis_column:
        analysis_column = 'goodsam-cs_Prosecution'
        logger.info("No analysis column provided, using default")
    
    # Create a temporary column for the ranges
    temp_column_name = f"{analysis_column}_binary_temp"

    numeric_values = df_sub[analysis_column]
    
    # Work with a numeric copy of the column if needed
    if not pd.api.types.is_numeric_dtype(df_sub[analysis_column]):
        numeric_values = pd.to_numeric(df_sub[analysis_column], errors='coerce')
    
    # Default initialization with all values as NaN (will be dropped)
    df_sub[temp_column_name] = np.nan
    
    # Apply active range (marked as 1)
    if active_range and len(active_range) == 2:
        min_val, max_val = active_range
        active_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
        df_sub.loc[active_mask, temp_column_name] = 1.0
    
    # Apply inactive range (marked as 0)
    if inactive_range and len(inactive_range) == 2:
        min_val, max_val = inactive_range
        inactive_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
        df_sub.loc[inactive_mask, temp_column_name] = 0.0
    
    # Drop rows that don't fall in either range
    df_sub = df_sub.dropna(subset=[temp_column_name]).reset_index(drop=True)
    
    # Use the temporary column for analysis
    analysis_column = temp_column_name

    fold_indices = kfold_indices(df_sub, 5)

    try:
        scores, mean_score = cross_validation_test(df_sub, analysis_column, fold_indices)
        print("Mean Score:", mean_score)
        
        # Clean up the temporary column if created
        if temp_column_name in df_sub.columns:
            df_sub.drop(columns=[temp_column_name], inplace=True)
            
        return mean_score
        
    except Exception as e:
        # Clean up the temporary column if created
        if temp_column_name in df_sub.columns:
            df_sub.drop(columns=[temp_column_name], inplace=True)
        
        print(f"Error in cross_validation_helper: {e}")
        raise e

# start backend

# Initialize backend and load patterns at startup
initialize_backend()

get_initial_patterns()


@app.route("/")
def home():
    return "backend is running"

@app.route("/health")
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/columns', methods=['GET'])
def get_columns():
    try:
        global df
        # Return all column names from the main dataframe
        columns = df.columns.tolist()
        return jsonify({'columns': columns}), 200
    except Exception as e:
        print(f"Error in /columns route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/column-ranges', methods=['GET'])
def get_column_ranges():
    try:
        global df, column_bounds
        
        # If column_bounds is not already populated, calculate it
        if not column_bounds:
            column_bounds = {}
            for column in df.columns:
                # For other columns, use actual min/max values
                column_bounds[column] = {
                    'min': math.floor(float(df[column].min())*10000)/10000,
                    'max': math.ceil(float(df[column].max())*10000)/10000
                }
        return jsonify({'columnRanges': column_bounds}), 200
    except Exception as e:
        print(f"Error in /column-ranges route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/list-files', methods=['GET'])
def list_files():
    """
    List available files in the data directory, optionally filtered by file type.
    Query parameters:
    - type: File extension to filter by (e.g., 'csv')
    """
    try:
        file_type = request.args.get('type', None)
        
        # Use environment variable for data directory or fallback to default
        data_dir = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
        
        # List all files in the data directory
        all_files = os.listdir(data_dir)
        
        # Filter by file type if specified
        if file_type:
            files = [f for f in all_files if f.lower().endswith(f'.{file_type.lower()}')]
        else:
            files = all_files
            
        return jsonify({'files': files}), 200
        
    except Exception as e:
        print(f"Error in /list-files route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/reload-data', methods=['POST'])
def reload_data():
    """
    Reinitialize the backend with the specified data files.
    Expected JSON body:
    {
        "mainFile": "filename.csv",  # Required
        "patternFile": "patterns.csv"  # Optional
    }
    """
    try:
        # Get file names from request
        data = request.json
        main_file = data.get('mainFile')
        pattern_file = data.get('patternFile')
        
        if not main_file:
            return jsonify({'error': 'Main file name is required'}), 400
            
        # Use environment variable for data directory or fallback to default
        data_dir = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
        
        # Check if files exist
        main_file_path = os.path.join(data_dir, main_file)
        if not os.path.exists(main_file_path):
            return jsonify({'error': f'Main file {main_file} not found in data directory'}), 404
            
        # If pattern file is provided, check if it exists
        if pattern_file:
            pattern_file_path = os.path.join(data_dir, pattern_file)
            if not os.path.exists(pattern_file_path):
                return jsonify({'error': f'Pattern file {pattern_file} not found in data directory'}), 404
        
        # Use our updated initialize_backend function with the specified files
        initialize_backend(main_file=main_file, pattern_file=pattern_file)
        
        # Reload patterns with default geomap and FIPS county files
        # get_initial_patterns()
        
        # Return success response
        return jsonify({
            'message': 'Data reloaded successfully', 
            'mainFile': main_file, 
            'patternFile': pattern_file
        }), 200
        
    except Exception as e:
        print(f"Error in /reload-data route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload a file to the data directory.
    
    Form data:
    - file: The file to upload
    - type: Type of file ('main' or 'pattern')
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
            
        file = request.files['file']
        file_type = request.form.get('type', 'unknown')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        # Use environment variable for data directory or fallback to default
        data_dir = os.environ.get('DATA_DIR', os.path.join(base_dir, '..', '..', 'data'))
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
        
        # Secure the filename to prevent directory traversal attacks
        filename = secure_filename(file.filename)
        
        # Save the file to the data directory
        file_path = os.path.join(data_dir, filename)
        file.save(file_path)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'type': file_type,
            'path': file_path
        }), 200
        
    except Exception as e:
        print(f"Error in /upload route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/histogram', methods=['GET'])
def get_histogram():
    try:
        # Get pattern number from query parameters
        pattern_no = request.args.get('pattern', default=29, type=int)
        logger.info(f"Received request for pattern number: {pattern_no}")

        result = pattern_BART(pattern_no)

        # Check if an error was returned
        if isinstance(result, tuple):
            return jsonify(result[0]), result[1]

        return jsonify(result), 200

    except Exception as e:
        print(f"Error in /histogram route: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/constraints', methods=['GET'])
def get_constraints():
    try:
        # Retrieve 'ID' from query parameters, defaulting to None if not provided
        id_param = request.args.get('ID', type=int)
        if id_param is None:
            return jsonify({'error': 'ID parameter is required and should be an integer.'}), 400

        # Lookup constraints in the preprocessed dictionary
        constraints = constraints_dict.get(id_param)
        countiesIndices = patterns_fips.get(id_param)
        constraintsBounds = patterns_constraints_dict.get(id_param)
        law = patterns_laws.get(id_param)

        if constraints is None:
            return jsonify({'error': f'ID {id_param} not found.'}), 404
        if countiesIndices is None:
            return jsonify({'error': f'ID {id_param} not found.'}), 404
        if constraintsBounds is None:
            return jsonify({'error': f'ID {id_param} not found.'}), 404
        # logger.info(countiesIndices)

        return jsonify({'ID': id_param, 'constraints': constraints, 'constraintsBounds': constraintsBounds, 'countiesIndices': countiesIndices, 'law': law}), 200

    except Exception as e:
        print(f"Error in /constraints route: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/geomapFilter', methods=['POST'])
def filter_geomap():
    """Lightweight endpoint that only returns FIPS codes without running BART analysis"""
    try:
        # Get constraints and law from request
        data = request.json
        constraints = data.get("constraints", {})
        law = data.get("law", "")
        active_range = data.get("activeRange")
        inactive_range = data.get("inactiveRange")
        
        if constraints is None:
            return jsonify({'error': 'Constraints are required'}), 400
        
        # Start with a copy of the main dataframe
        global df_geomap, df, df_fips_county
        fips_col = df_geomap['FIPS']
        df_sub = df.copy(deep=True)
        df_sub.insert(0, "FIPS", fips_col)
        
        # Format and apply conditions
        conds = format_conditions(constraints)
        
        if len(conds) != 0:
            for cond in conds:
                try:
                    df_sub = df_sub.loc[eval(cond)].reset_index(drop=True)
                except Exception as e:
                    logger.info(f"Error evaluating condition '{cond}': {e}")
                    return jsonify({"error": f"Invalid condition: {cond}"}), 400
        else:
            logger.info("No filters in pattern")
        
        if df_sub.empty:
            logger.info("Filtered data is empty.")
            return jsonify({"countiesIndices": []}), 200  # Return empty array, not error
        
        # Default law if none specified
        if not law:
            if len(df.columns) > 31:
                law = df.columns[31] 
                logger.info(f"No law specified, using first available: {law}")
            else:
                # If there are fewer than 28 columns, create a dummy column with all zeros
                # This ensures we still get county indices even if there are no treatment columns
                logger.info("No treatment columns available, using dummy column")
                df_sub['dummy_law'] = 0
                law = 'dummy_law'
        
        temp_column_name = f"{law}_binary_temp"
        numeric_values = df_sub[law]
        
        # Work with a numeric copy of the column if needed
        if not pd.api.types.is_numeric_dtype(df_sub[law]):
            numeric_values = pd.to_numeric(df_sub[law], errors='coerce')
        
        # Default initialization with all values as NaN (will be dropped)
        df_sub[temp_column_name] = np.nan
        
        # Apply active range (marked as 1)
        if active_range and len(active_range) == 2:
            min_val, max_val = active_range
            active_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
            df_sub.loc[active_mask, temp_column_name] = 1.0
        
        # Apply inactive range (marked as 0)
        if inactive_range and len(inactive_range) == 2:
            min_val, max_val = inactive_range
            inactive_mask = (numeric_values >= min_val) & (numeric_values <= max_val)
            df_sub.loc[inactive_mask, temp_column_name] = 0.0
        
        # For rows that don't fall into either range, assign NaN (will be excluded from analysis)
        # Get active/inactive counties
        law_active_mask = df_sub[temp_column_name] == 1
        law_inactive_mask = df_sub[temp_column_name] == 0
        
        # Get FIPS codes for counties with active/inactive law
        active_fips = df_sub.loc[law_active_mask, 'FIPS'].tolist()
        inactive_fips = df_sub.loc[law_inactive_mask, 'FIPS'].tolist()
        fips = df_sub['FIPS'].tolist()
        
        # Clean up the temporary column if created
        if temp_column_name in df_sub.columns:
            df_sub.drop(columns=[temp_column_name], inplace=True)

        return jsonify({
            'countiesIndices': fips,
            'activeCountiesIndices': active_fips,
            'inactiveCountiesIndices': inactive_fips
        }), 200

    except Exception as e:
        print(f"Error in /geomapFilter route: {str(e)}")
        return jsonify({'error': str(e)}), 500
       
@app.route('/userPattern', methods=['POST'])
def get_pattern():
    try:
        # Retrieve data from request
        data = request.json
        constraints = data.get("constraints", {})
        analysis_column = data.get("law", "") 
        active_range = data.get("activeRange")
        inactive_range = data.get("inactiveRange")

        logger.info("USER SET PATTERN")
        if constraints is None or analysis_column is None:
            return jsonify({'error': 'Pattern and column_name are required'}), 400
        
        # Call modified constraints_BART function
        result = constraints_BART(constraints, analysis_column, active_range, inactive_range)

        # Check if result is an error response (tuple with 2 items)
        if isinstance(result, tuple) and len(result) == 2 and isinstance(result[0], dict) and 'error' in result[0]:
            # This is an error response, return it directly
            return jsonify(result[0]), result[1]

        # Otherwise, unpack the 6 values
        result, fips, counties, states, active_fips, inactive_fips = result

        if fips is None:
            return jsonify({'error': f'FIPS not found.'}), 404
        if isinstance(result, tuple):
            return jsonify(result[0]), result[1]

        return jsonify({'countiesIndices': fips, 'activeCountiesIndices': active_fips,
            'inactiveCountiesIndices': inactive_fips, 'histData': result, 'countyNames':counties, 'stateNames': states}), 200

    except Exception as e:
        print(f"Error in /userPattern route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/crossVal', methods=['POST'])
def cross_val():
    try:
        # Retrieve data from request
        data = request.json
        constraints = data.get("constraints", {})
        analysis_column = data.get("law", "") 
        active_range = data.get("activeRange")
        inactive_range = data.get("inactiveRange")
        
        logger.info("USER SET PATTERN - K FOLD")
        if constraints is None or analysis_column is None:
            return jsonify({'error': 'Pattern and column_name are required'}), 400

        # K-Fold Cross Validation
        result = cross_validation_helper(constraints, analysis_column, active_range, inactive_range)

        return jsonify({'kFoldNRMSE': result}), 200

    except Exception as e:
        print(f"Error in /crossVal route: {e}")
        return jsonify({'error': str(e)}), 500

# Run the Flask app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)