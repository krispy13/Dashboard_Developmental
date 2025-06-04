from sklearn.model_selection import train_test_split
from sklearn import preprocessing
import numpy as np

# construct train test data 
def prepare_train_data(df, law):
    train_idxs, test_idxs = train_test_split(list(df.index), test_size=0.2, random_state=1)

    X_df = df.iloc[:, :27].to_numpy()
    M = X_df.shape[1] 

    y = df[['delta_death_rate']].to_numpy()
    Z_law = df[[law]].to_numpy()
    # numerical columns
    num_cols = [c for c in range(M) if len(np.unique(X_df[:, c])) > 2] 


    X_train = X_df[train_idxs,:]
    X_test = X_df[test_idxs,:]

    y_train = y[train_idxs,:]
    y_test= y[test_idxs,:]

    Z_train = Z_law[train_idxs,:]
    Z_test= Z_law[test_idxs,:]

    # standardize data
    scaler_ = preprocessing.StandardScaler().fit(X_train[:,num_cols])
    X_train_scaled = np.copy(X_train)
    X_train_scaled[:,num_cols] = scaler_.transform(X_train[:,num_cols])

    X_test_scaled = np.copy(X_test)
    X_test_scaled[:,num_cols] = scaler_.transform(X_test[:,num_cols])
    return X_train_scaled, y_train, Z_train, X_test_scaled, y_test, Z_test


def rmse(y, y_pred):
    rmse = np.sqrt((np.sum((y - y_pred) ** 2) / y.shape[0]))
    return rmse


def nrmse(y, y_pred, norm_method):
    rmse = np.sqrt((np.sum((y - y_pred) ** 2) / y.shape[0]))
    if norm_method=='mean':
        nrmse = rmse / y.mean()
    elif norm_method=='range':
        nrmse = rmse / (y.max() - y.min())
    else:
        nrmse = rmse
    return nrmse


def r_square(y, y_pred):
    # residual sum of squares
    ss_res = np.sum((y - y_pred) ** 2)

    # total sum of squares
    ss_tot = np.sum((y - np.mean(y)) ** 2)

    # r-squared
    r2 = 1 - (ss_res / ss_tot)
    return r2


def coverage_rate(y, y_lb, y_ub):
    cond1 = (y > y_lb)
    cond2 = (y_ub > y)

    count = (cond1 * cond2).sum()
    return (count/y.size)


def kfold_indices(data, k):

    fold_size = len(data) // k
    indices = np.arange(len(data))
    folds = []
    for i in range(k):
        test_indices = indices[i * fold_size: (i + 1) * fold_size]
        train_indices = np.concatenate([indices[:i * fold_size], indices[(i + 1) * fold_size:]])
        folds.append((train_indices, test_indices))
    return folds


# construct train test data 
def prepare_permute_data(df, law):

    X_df = df.iloc[:, :27].to_numpy()
    M = X_df.shape[1] 

    y = df[['delta_death_rate']].to_numpy()
    Z_law = df[[law]].to_numpy()
    # numerical columns
    num_cols = [c for c in range(M) if len(np.unique(X_df[:, c])) > 2] 


    # standardize data
    scaler_ = preprocessing.StandardScaler().fit(X_df[:,num_cols])
    X_scaled = np.copy(X_df)
    X_scaled[:,num_cols] = scaler_.transform(X_df[:,num_cols])

    return X_scaled, y, Z_law


# prepare for permutation test
def statistic(x, y):
    return np.mean(x) - np.mean(y)
