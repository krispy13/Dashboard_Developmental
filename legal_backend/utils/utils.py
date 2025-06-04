import pandas as pd
import numpy as np

def convert_to_numpy(data):
    """ Converts data to a numpy array. """
    if isinstance(data, np.ndarray):  # already numpy
        return data        

    if isinstance(data, list):
        return np.array(data)
    
    if isinstance(data, pd.core.series.Series) or isinstance(data, pd.core.frame.DataFrame):
        return data.values
    
    raise TypeError("data is not a valid array type.")


def convert_and_expand(X):
    """ Converts data to numpy and reshapes if necessary. """
    X = convert_to_numpy(X)
    if X.ndim == 1:  # convert to 2D
        X = X[:,np.newaxis]
        
    return X