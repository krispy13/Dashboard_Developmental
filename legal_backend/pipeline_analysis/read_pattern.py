import pandas as pd
import numpy as np
import math
from typing import List, Tuple

def read_pattern(origin_str:str, df_name:str, df_sub:pd.DataFrame)-> Tuple[pd.DataFrame, List[int], List[str], str]:
    """Convert a pattern to filters
    Args:
        origin_str: A original pattern as string 
        df_name: Variable name of the dataframe
        df: Original dataframe
    Returns:
        Filtered dataframe, filtered dataframe indices, list of pattern constraints, law in pattern
    """
    conds = []
    law = ""
    pattern_dict = eval(origin_str, {'inf': math.inf, '-inf':-math.inf})['constraints']
    # print(pattern_dict)

    for key,bound in pattern_dict.items():

        # print(key, bound)

        if df_sub.columns.get_loc(key) >= 27:
          law = key
          continue

        if 'in' in bound.keys():
            cond = ""+df_name+"['"+str(key)+"'].isin("+str(bound['in'])+")"
            df_sub = df_sub.loc[eval(cond)]
            conds.append(cond)
        elif 'lb' in bound.keys() or 'ub' in bound.keys():
            if bound['lb'] == bound['ub']:
                cond = ""+df_name+"['"+str(key)+"']=="+str(bound['lb'])
                df_sub = df_sub.loc[eval(cond)]
                conds.append(cond)
            else:
                if bound['lb'] != -math.inf:
                    cond1 = ""+df_name+"['"+str(key)+"']>="+str(bound['lb'])
                    df_sub = df_sub.loc[eval(cond1)]
                    conds.append(cond1)
                if bound['ub'] != math.inf:
                    cond2 = ""+df_name+"['"+str(key)+"']<="+str(bound['ub'])
                    df_sub = df_sub.loc[eval(cond2)]
                    conds.append(cond2)
        else:
            print("Error Constraint, key:",key)
    df_idx = list(df_sub.index)
    df_sub = df_sub.reset_index(drop=True)
    return df_sub, df_idx, conds, law




# if __name__ == '__main__':

#     df_pt = pd.read_csv("data/patterns_for_opioid_death.csv")
#     df_sub = pd.read_csv("data/goodsam_all.csv")

#     filterd_patterns_data = dict()
#     patterns_constraints = dict()
#     patterns_laws = dict()
#     for i in range(df_pt.shape[0]):
#         print(i)
#         _, df_idx, conds, law = read_pattern(df_pt.iloc[i]['description'], 'df_sub', df_sub)
#         filterd_patterns_data[i] = df_idx
#         patterns_constraints[i] = conds
#         patterns_laws[i] = law


